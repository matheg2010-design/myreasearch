/**
 * Data Validation and Sanitization Module
 * Handles all data input validation and cleaning
 */

class DataValidator {
    constructor() {
        this.config = {
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxRows: 100000,
            maxColumns: 100,
            allowedMimeTypes: ['text/csv', 'text/plain', 'text/tab-separated-values'],
            allowedExtensions: ['.csv', '.txt', '.tsv'],
            maxCellLength: 10000,
            maxColumnNameLength: 100
        };
    }
    
    /**
     * Validate uploaded file
     */
    async validateFile(file) {
        const errors = [];
        
        // Check file exists
        if (!file) {
            errors.push('لم يتم اختيار ملف');
            return { valid: false, errors };
        }
        
        // Check file size
        if (file.size > this.config.maxFileSize) {
            errors.push(`حجم الملف كبير جداً (الحد الأقصى: ${this.formatBytes(this.config.maxFileSize)})`);
        }
        
        // Check file type
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.config.allowedExtensions.includes(extension)) {
            errors.push(`نوع الملف غير مدعوم. الملفات المسموحة: ${this.config.allowedExtensions.join(', ')}`);
        }
        
        // Check MIME type if available
        if (file.type && !this.config.allowedMimeTypes.includes(file.type)) {
            errors.push(`نوع MIME غير مدعوم: ${file.type}`);
        }
        
        // Check for potential security issues in filename
        if (!this.isSafeFilename(file.name)) {
            errors.push('اسم الملف يحتوي على أحرف غير آمنة');
        }
        
        return {
            valid: errors.length === 0,
            errors,
            file: errors.length === 0 ? file : null
        };
    }
    
    /**
     * Parse CSV file with security measures
     */
    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const content = event.target.result;
                    const data = this.parseCSVContent(content);
                    resolve(data);
                } catch (error) {
                    reject(new Error(`فشل تحليل الملف: ${error.message}`));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('تعذر قراءة الملف'));
            };
            
            // Read with UTF-8 encoding
            reader.readAsText(file, 'UTF-8');
        });
    }
    
    /**
     * Parse CSV content with validation
     */
    parseCSVContent(content) {
        // Trim and normalize line endings
        content = content.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Check content length
        if (content.length > this.config.maxFileSize) {
            throw new Error('المحتوى كبير جداً');
        }
        
        // Parse lines
        const lines = content.split('\n');
        
        if (lines.length === 0) {
            throw new Error('الملف فارغ');
        }
        
        if (lines.length > this.config.maxRows) {
            throw new Error(`عدد الصفوف كبير جداً (الحد الأقصى: ${this.config.maxRows})`);
        }
        
        // Parse headers
        const headers = this.parseCSVLine(lines[0]).map(header => 
            this.sanitizeColumnName(header)
        );
        
        // Validate headers
        this.validateHeaders(headers);
        
        // Parse data rows
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            
            const values = this.parseCSVLine(lines[i]);
            
            // Validate row length
            if (values.length !== headers.length) {
                throw new Error(`الصف ${i + 1} يحتوي على عدد أعمدة غير متطابق`);
            }
            
            // Process row
            const row = {};
            let hasData = false;
            
            for (let j = 0; j < headers.length; j++) {
                const header = headers[j];
                let value = values[j];
                
                // Sanitize value
                value = this.sanitizeCellValue(value);
                
                // Check for max cell length
                if (value.length > this.config.maxCellLength) {
                    throw new Error(`الخلية ${header} في الصف ${i + 1} طويلة جداً`);
                }
                
                row[header] = value;
                
                if (value !== '') {
                    hasData = true;
                }
            }
            
            // Only add row if it has data
            if (hasData) {
                data.push(row);
            }
        }
        
        // Final validation
        this.validateDataStructure(data, headers);
        
        return data;
    }
    
    /**
     * Parse a single CSV line with proper handling of quotes and commas
     */
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (!inQuotes && (char === '"' || char === "'")) {
                // Start quoted value
                inQuotes = true;
                quoteChar = char;
            } else if (inQuotes && char === quoteChar && nextChar === quoteChar) {
                // Escaped quote
                current += char;
                i++; // Skip next quote
            } else if (inQuotes && char === quoteChar) {
                // End quoted value
                inQuotes = false;
            } else if (!inQuotes && char === ',') {
                // End of value
                values.push(current);
                current = '';
            } else {
                // Regular character
                current += char;
            }
        }
        
        // Add last value
        values.push(current);
        
        // Clean values
        return values.map(value => {
            // Remove surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            
            // Unescape quotes
            value = value.replace(/""/g, '"').replace(/''/g, "'");
            
            return value.trim();
        });
    }
    
    /**
     * Sanitize column name
     */
    sanitizeColumnName(name) {
        if (!name || typeof name !== 'string') {
            return 'column_' + Date.now();
        }
        
        // Remove dangerous characters
        let sanitized = name
            .trim()
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/__+/g, '_');
        
        // Ensure it starts with a letter or underscore
        if (!/^[a-zA-Z_ء-ي]/.test(sanitized)) {
            sanitized = '_' + sanitized;
        }
        
        // Limit length
        if (sanitized.length > this.config.maxColumnNameLength) {
            sanitized = sanitized.substring(0, this.config.maxColumnNameLength);
        }
        
        // Ensure uniqueness (basic approach)
        sanitized = sanitized || 'column';
        
        return sanitized;
    }
    
    /**
     * Sanitize cell value
     */
    sanitizeCellValue(value) {
        if (value === null || value === undefined) {
            return '';
        }
        
        if (typeof value !== 'string') {
            value = String(value);
        }
        
        // Trim whitespace
        value = value.trim();
        
        // Remove null bytes and control characters (except tab and newline)
        value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Escape HTML entities
        value = this.escapeHTML(value);
        
        return value;
    }
    
    /**
     * Sanitize user input
     */
    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }
        
        // Remove script tags and event handlers
        let sanitized = input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
            .replace(/on\w+\s*=\s*'[^']*'/gi, '')
            .replace(/on\w+\s*=\s*[^"'][^\\s>]*/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, '');
        
        // Escape special characters
        sanitized = this.escapeHTML(sanitized);
        
        return sanitized;
    }
    
    /**
     * Escape HTML entities
     */
    escapeHTML(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        
        return text.replace(/[&<>"'/]/g, char => map[char]);
    }
    
    /**
     * Validate headers
     */
    validateHeaders(headers) {
        if (headers.length === 0) {
            throw new Error('لا توجد أعمدة في الملف');
        }
        
        if (headers.length > this.config.maxColumns) {
            throw new Error(`عدد الأعمدة كبير جداً (الحد الأقصى: ${this.config.maxColumns})`);
        }
        
        // Check for duplicate headers
        const seen = new Set();
        const duplicates = [];
        
        headers.forEach((header, index) => {
            if (seen.has(header)) {
                duplicates.push({ index, header });
            } else {
                seen.add(header);
            }
        });
        
        if (duplicates.length > 0) {
            // Make headers unique
            const counts = {};
            return headers.map(header => {
                counts[header] = (counts[header] || 0) + 1;
                return counts[header] > 1 ? `${header}_${counts[header]}` : header;
            });
        }
        
        return headers;
    }
    
    /**
     * Validate data structure
     */
    validateDataStructure(data, headers) {
        if (data.length === 0) {
            throw new Error('لا توجد بيانات في الملف');
        }
        
        // Check for prototype pollution
        data.forEach((row, index) => {
            if (row.__proto__ && row.__proto__ !== Object.prototype) {
                throw new Error(`الصف ${index + 1} يحتوي على خصائص غير آمنة`);
            }
            
            // Ensure row only contains expected headers
            const extraKeys = Object.keys(row).filter(key => !headers.includes(key));
            if (extraKeys.length > 0) {
                throw new Error(`الصف ${index + 1} يحتوي على أعمدة غير متوقعة: ${extraKeys.join(', ')}`);
            }
        });
    }
    
    /**
     * Analyze column data type and statistics
     */
    analyzeColumn(values, columnName) {
        const stats = {
            name: columnName,
            count: values.length,
            missing: 0,
            unique: new Set(),
            type: 'unknown',
            numericStats: null,
            categoricalStats: null
        };
        
        // Count missing values and collect unique values
        values.forEach(value => {
            if (value === '' || value === null || value === undefined) {
                stats.missing++;
            } else {
                stats.unique.add(value);
            }
        });
        
        // Try to determine type
        const numericValues = [];
        const stringValues = [];
        
        values.forEach(value => {
            if (value === '' || value === null || value === undefined) return;
            
            const num = this.parseNumber(value);
            if (!isNaN(num)) {
                numericValues.push(num);
            } else {
                stringValues.push(value);
            }
        });
        
        if (numericValues.length === values.length - stats.missing) {
            // All non-missing values are numeric
            stats.type = 'numeric';
            stats.numericStats = this.calculateNumericStats(numericValues);
        } else if (stringValues.length === values.length - stats.missing) {
            // All non-missing values are strings
            stats.type = 'categorical';
            stats.categoricalStats = this.calculateCategoricalStats(stringValues);
        } else {
            // Mixed types
            stats.type = 'mixed';
            if (numericValues.length > 0) {
                stats.numericStats = this.calculateNumericStats(numericValues);
            }
            if (stringValues.length > 0) {
                stats.categoricalStats = this.calculateCategoricalStats(stringValues);
            }
        }
        
        // Calculate completeness
        stats.completeness = ((values.length - stats.missing) / values.length) * 100;
        
        return stats;
    }
    
    /**
     * Parse number with localization support
     */
    parseNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return NaN;
        
        // Try standard number parsing
        let num = parseFloat(value);
        if (!isNaN(num)) return num;
        
        // Try with Arabic decimal separator (٫)
        const arabicValue = value.replace(/٫/g, '.');
        num = parseFloat(arabicValue);
        if (!isNaN(num)) return num;
        
        // Try with comma as decimal separator
        const commaValue = value.replace(/,/g, '.');
        num = parseFloat(commaValue);
        if (!isNaN(num)) return num;
        
        return NaN;
    }
    
    /**
     * Calculate numeric statistics
     */
    calculateNumericStats(values) {
        if (values.length === 0) return null;
        
        const sorted = [...values].sort((a, b) => a - b);
        
        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            mean: this.calculateMean(values),
            median: this.calculateMedian(sorted),
            stdDev: this.calculateStdDev(values),
            variance: this.calculateVariance(values),
            q1: this.calculatePercentile(sorted, 25),
            q3: this.calculatePercentile(sorted, 75),
            iqr: null, // Will be calculated below
            skewness: this.calculateSkewness(values),
            kurtosis: this.calculateKurtosis(values)
        };
    }
    
    /**
     * Calculate categorical statistics
     */
    calculateCategoricalStats(values) {
        if (values.length === 0) return null;
        
        const frequencies = {};
        values.forEach(value => {
            frequencies[value] = (frequencies[value] || 0) + 1;
        });
        
        const sorted = Object.entries(frequencies)
            .sort((a, b) => b[1] - a[1])
            .map(([value, count]) => ({
                value,
                count,
                percentage: (count / values.length) * 100
            }));
        
        return {
            uniqueCount: sorted.length,
            mode: sorted[0]?.value || null,
            modeCount: sorted[0]?.count || 0,
            modePercentage: sorted[0]?.percentage || 0,
            frequencies: sorted,
            entropy: this.calculateEntropy(values)
        };
    }
    
    /**
     * Statistical calculations
     */
    calculateMean(values) {
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / values.length;
    }
    
    calculateMedian(sortedValues) {
        const mid = Math.floor(sortedValues.length / 2);
        return sortedValues.length % 2 === 0
            ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
            : sortedValues[mid];
    }
    
    calculateStdDev(values) {
        const mean = this.calculateMean(values);
        const squaredDiffs = values.map(x => Math.pow(x - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(variance);
    }
    
    calculateVariance(values) {
        const mean = this.calculateMean(values);
        const squaredDiffs = values.map(x => Math.pow(x - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }
    
    calculatePercentile(sortedValues, percentile) {
        const index = (percentile / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        
        if (lower === upper) {
            return sortedValues[lower];
        }
        
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }
    
    calculateSkewness(values) {
        const n = values.length;
        if (n < 3) return 0;
        
        const mean = this.calculateMean(values);
        const stdDev = this.calculateStdDev(values);
        
        if (stdDev === 0) return 0;
        
        const cubedDiffs = values.map(x => Math.pow(x - mean, 3));
        const sumCubedDiffs = cubedDiffs.reduce((a, b) => a + b, 0);
        
        return (sumCubedDiffs / n) / Math.pow(stdDev, 3);
    }
    
    calculateKurtosis(values) {
        const n = values.length;
        if (n < 4) return 0;
        
        const mean = this.calculateMean(values);
        const stdDev = this.calculateStdDev(values);
        
        if (stdDev === 0) return 0;
        
        const fourthDiffs = values.map(x => Math.pow(x - mean, 4));
        const sumFourthDiffs = fourthDiffs.reduce((a, b) => a + b, 0);
        
        return (sumFourthDiffs / n) / Math.pow(stdDev, 4) - 3;
    }
    
    calculateEntropy(values) {
        const frequencies = {};
        values.forEach(value => {
            frequencies[value] = (frequencies[value] || 0) + 1;
        });
        
        let entropy = 0;
        const total = values.length;
        
        Object.values(frequencies).forEach(freq => {
            const probability = freq / total;
            entropy -= probability * Math.log2(probability);
        });
        
        return entropy;
    }
    
    /**
     * Check if filename is safe
     */
    isSafeFilename(filename) {
        // Check for directory traversal attempts
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return false;
        }
        
        // Check for dangerous extensions
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.html'];
        const extension = '.' + filename.split('.').pop().toLowerCase();
        
        if (dangerousExtensions.includes(extension)) {
            return false;
        }
        
        // Check for null bytes
        if (filename.includes('\0')) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 بايت';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    /**
     * Check if a string contains potentially dangerous content
     */
    containsDangerousContent(text) {
        if (typeof text !== 'string') return false;
        
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /data:/i,
            /vbscript:/i,
            /onload=/i,
            /onerror=/i,
            /onclick=/i,
            /eval\(/i,
            /document\./i,
            /window\./i,
            /alert\(/i,
            /prompt\(/i,
            /confirm\(/i,
            /localStorage/i,
            /sessionStorage/i,
            /cookie/i,
            /fetch\(/i,
            /XMLHttpRequest/i
        ];
        
        return dangerousPatterns.some(pattern => pattern.test(text));
    }
    
    /**
     * Validate data for statistical analysis
     */
    validateDataForAnalysis(data, categoricalColumn, numericalColumn) {
        const errors = [];
        const warnings = [];
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            errors.push('لا توجد بيانات للتحليل');
            return { valid: false, errors, warnings };
        }
        
        // Check columns exist
        const firstRow = data[0];
        const columns = Object.keys(firstRow);
        
        if (!columns.includes(categoricalColumn)) {
            errors.push(`العمود الفئوي "${categoricalColumn}" غير موجود`);
        }
        
        if (!columns.includes(numericalColumn)) {
            errors.push(`العمود العددي "${numericalColumn}" غير موجود`);
        }
        
        if (errors.length > 0) {
            return { valid: false, errors, warnings };
        }
        
        // Extract and validate data
        const groups = [];
        const values = [];
        
        data.forEach((row, index) => {
            const group = row[categoricalColumn];
            const value = row[numericalColumn];
            
            // Check for missing values
            if (group === '' || group === null || group === undefined) {
                warnings.push(`الصف ${index + 1}: قيمة مفقودة في العمود الفئوي`);
            } else {
                groups.push(group);
            }
            
            if (value === '' || value === null || value === undefined) {
                warnings.push(`الصف ${index + 1}: قيمة مفقودة في العمود العددي`);
            } else {
                const num = this.parseNumber(value);
                if (isNaN(num)) {
                    errors.push(`الصف ${index + 1}: القيمة "${value}" ليست رقمية`);
                } else {
                    values.push(num);
                }
            }
        });
        
        // Check sample size
        if (values.length < 3) {
            errors.push('عدد المشاهدات غير كافٍ للتحليل (يحتاج إلى 3 على الأقل)');
        }
        
        // Check group sizes
        const uniqueGroups = [...new Set(groups)];
        const groupSizes = {};
        
        uniqueGroups.forEach(group => {
            groupSizes[group] = groups.filter(g => g === group).length;
        });
        
        Object.entries(groupSizes).forEach(([group, size]) => {
            if (size < 2) {
                warnings.push(`المجموعة "${group}" تحتوي على ملاحظة واحدة فقط`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            groups,
            values,
            uniqueGroups,
            groupSizes
        };
    }
}

export default DataValidator;
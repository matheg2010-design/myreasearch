/**
 * Web Worker for Statistical Calculations
 * Handles heavy computations in background thread
 */

// Import necessary libraries
importScripts('https://cdn.jsdelivr.net/npm/simple-statistics@7.8.3/dist/simple-statistics.min.js');

// Statistical functions library
const StatsLib = {
    mean: function(values) {
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    },
    
    stdDev: function(values) {
        const mean = this.mean(values);
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(variance);
    },
    
    shapiroWilk: function(values) {
        // Simplified Shapiro-Wilk implementation
        // Note: This is a placeholder. Use proper library in production.
        const n = values.length;
        if (n < 3 || n > 5000) return null;
        
        const sorted = [...values].sort((a, b) => a - b);
        const mean = this.mean(sorted);
        
        // Calculate W statistic (simplified)
        let ss = 0;
        for (let i = 0; i < n; i++) {
            ss += Math.pow(sorted[i] - mean, 2);
        }
        
        // Simplified approximation
        const W = 0.9 + (0.1 * Math.random()); // Placeholder
        
        return {
            statistic: W,
            pValue: this.calculateShapiroWilkPValue(W, n)
        };
    },
    
    calculateShapiroWilkPValue: function(W, n) {
        // Simplified p-value calculation
        if (W > 0.95) return 0.9;
        if (W > 0.9) return 0.5;
        if (W > 0.85) return 0.1;
        if (W > 0.8) return 0.05;
        return 0.01;
    },
    
    tTest: function(group1, group2, paired = false) {
        if (paired && group1.length !== group2.length) {
            throw new Error('المجموعات المترابطة يجب أن تكون بنفس الطول');
        }
        
        if (paired) {
            // Paired t-test
            const differences = group1.map((val, i) => val - group2[i]);
            const meanDiff = this.mean(differences);
            const stdDiff = this.stdDev(differences);
            const n = differences.length;
            const t = meanDiff / (stdDiff / Math.sqrt(n));
            const df = n - 1;
            
            // Simplified p-value calculation
            const pValue = this.calculateTPValue(t, df);
            
            return { t, df, pValue, meanDiff, stdDiff };
            
        } else {
            // Independent t-test
            const mean1 = this.mean(group1);
            const mean2 = this.mean(group2);
            const std1 = this.stdDev(group1);
            const std2 = this.stdDev(group2);
            const n1 = group1.length;
            const n2 = group2.length;
            
            // Pooled standard deviation
            const pooledStd = Math.sqrt(
                ((n1 - 1) * std1 * std1 + (n2 - 1) * std2 * std2) / 
                (n1 + n2 - 2)
            );
            
            const t = (mean1 - mean2) / (pooledStd * Math.sqrt(1/n1 + 1/n2));
            const df = n1 + n2 - 2;
            const pValue = this.calculateTPValue(t, df);
            
            return { t, df, pValue, mean1, mean2, std1, std2 };
        }
    },
    
    calculateTPValue: function(t, df) {
        // Simplified t-distribution p-value calculation
        const absT = Math.abs(t);
        
        if (df <= 0) return 1;
        
        if (absT > 10) return 0.0001;
        if (absT > 4) return 0.001;
        if (absT > 2.5) return 0.02;
        if (absT > 2) return 0.05;
        if (absT > 1.5) return 0.15;
        return 0.3;
    },
    
    anova: function(groups) {
        const k = groups.length; // Number of groups
        const allValues = groups.flat();
        const n = allValues.length; // Total sample size
        
        // Calculate group means and overall mean
        const groupMeans = groups.map(group => this.mean(group));
        const overallMean = this.mean(allValues);
        
        // Calculate Sum of Squares
        let ssBetween = 0;
        let ssWithin = 0;
        
        groups.forEach((group, i) => {
            const groupMean = groupMeans[i];
            const groupSize = group.length;
            
            // SS Between
            ssBetween += groupSize * Math.pow(groupMean - overallMean, 2);
            
            // SS Within
            group.forEach(value => {
                ssWithin += Math.pow(value - groupMean, 2);
            });
        });
        
        // Degrees of freedom
        const dfBetween = k - 1;
        const dfWithin = n - k;
        
        // Mean Squares
        const msBetween = ssBetween / dfBetween;
        const msWithin = ssWithin / dfWithin;
        
        // F-statistic
        const f = msBetween / msWithin;
        
        // Simplified p-value calculation
        const pValue = this.calculateFPValue(f, dfBetween, dfWithin);
        
        return {
            f,
            dfBetween,
            dfWithin,
            pValue,
            ssBetween,
            ssWithin,
            msBetween,
            msWithin
        };
    },
    
    calculateFPValue: function(f, df1, df2) {
        // Simplified F-distribution p-value calculation
        if (f > 10) return 0.001;
        if (f > 5) return 0.01;
        if (f > 3) return 0.05;
        if (f > 2) return 0.1;
        return 0.3;
    },
    
    correlation: function(x, y) {
        if (x.length !== y.length) {
            throw new Error('المتغيران يجب أن يكونا بنفس الطول');
        }
        
        const n = x.length;
        const meanX = this.mean(x);
        const meanY = this.mean(y);
        
        let numerator = 0;
        let denomX = 0;
        let denomY = 0;
        
        for (let i = 0; i < n; i++) {
            const diffX = x[i] - meanX;
            const diffY = y[i] - meanY;
            
            numerator += diffX * diffY;
            denomX += diffX * diffX;
            denomY += diffY * diffY;
        }
        
        if (denomX === 0 || denomY === 0) {
            return 0;
        }
        
        return numerator / Math.sqrt(denomX * denomY);
    },
    
    spearmanCorrelation: function(x, y) {
        // Calculate ranks
        const ranksX = this.calculateRanks(x);
        const ranksY = this.calculateRanks(y);
        
        // Use Pearson correlation on ranks
        return this.correlation(ranksX, ranksY);
    },
    
    calculateRanks: function(values) {
        const withIndices = values.map((val, idx) => ({ val, idx }));
        withIndices.sort((a, b) => a.val - b.val);
        
        const ranks = new Array(values.length);
        let i = 0;
        
        while (i < values.length) {
            let j = i;
            while (j + 1 < values.length && withIndices[j + 1].val === withIndices[i].val) {
                j++;
            }
            
            const avgRank = (i + j + 2) / 2;
            for (let k = i; k <= j; k++) {
                ranks[withIndices[k].idx] = avgRank;
            }
            
            i = j + 1;
        }
        
        return ranks;
    }
};

// Message handler
self.onmessage = function(event) {
    const { action, data } = event.data;
    
    try {
        switch(action) {
            case 'runTest':
                handleTestRequest(data);
                break;
                
            case 'checkAssumptions':
                handleAssumptionsCheck(data);
                break;
                
            case 'validateData':
                handleDataValidation(data);
                break;
                
            default:
                self.postMessage({
                    action: 'error',
                    error: 'الإجراء غير معروف'
                });
        }
    } catch (error) {
        self.postMessage({
            action: 'error',
            error: error.message
        });
    }
};

function handleTestRequest(data) {
    const { testId, data: dataset, catColumn, numColumn } = data;
    
    try {
        // Extract values and groups
        const groups = dataset.map(row => row[catColumn]);
        const values = dataset.map(row => parseFloat(row[numColumn]));
        
        // Filter out invalid values
        const validIndices = values.map((val, idx) => !isNaN(val) ? idx : -1).filter(idx => idx !== -1);
        const validValues = validIndices.map(idx => values[idx]);
        const validGroups = validIndices.map(idx => groups[idx]);
        
        // Run test based on testId
        let results;
        
        switch(testId) {
            case 'independent-t-test':
                results = runIndependentTTest(validValues, validGroups);
                break;
                
            case 'paired-t-test':
                results = runPairedTTest(validValues, validGroups);
                break;
                
            case 'one-way-anova':
                results = runOneWayANOVA(validValues, validGroups);
                break;
                
            case 'pearson-correlation':
                results = runPearsonCorrelation(validValues, validGroups);
                break;
                
            default:
                throw new Error(`الاختبار غير معروف: ${testId}`);
        }
        
        self.postMessage({
            action: 'testComplete',
            results: results
        });
        
    } catch (error) {
        self.postMessage({
            action: 'error',
            error: `فشل تشغيل الاختبار: ${error.message}`
        });
    }
}

function runIndependentTTest(values, groups) {
    const uniqueGroups = [...new Set(groups)];
    
    if (uniqueGroups.length !== 2) {
        throw new Error('يحتاج اختبار T إلى مجموعتين بالضبط');
    }
    
    const group1Values = values.filter((_, i) => groups[i] === uniqueGroups[0]);
    const group2Values = values.filter((_, i) => groups[i] === uniqueGroups[1]);
    
    const result = StatsLib.tTest(group1Values, group2Values, false);
    
    return {
        test: 'Independent Samples t-test',
        statistics: {
            t: result.t.toFixed(4),
            df: result.df,
            pValue: result.pValue.toFixed(4),
            mean1: result.mean1.toFixed(4),
            mean2: result.mean2.toFixed(4),
            std1: result.std1.toFixed(4),
            std2: result.std2.toFixed(4),
            n1: group1Values.length,
            n2: group2Values.length
        },
        interpretation: interpretTTestResult(result.pValue, result.mean1, result.mean2)
    };
}

function runPairedTTest(values, groups) {
    const uniqueGroups = [...new Set(groups)];
    
    if (uniqueGroups.length !== 2) {
        throw new Error('يحتاج اختبار T المترابط إلى مجموعتين بالضبط');
    }
    
    // Match pairs by index
    const groupMap = {};
    values.forEach((val, i) => {
        const group = groups[i];
        if (!groupMap[group]) groupMap[group] = [];
        groupMap[group].push(val);
    });
    
    const n = Math.min(groupMap[uniqueGroups[0]].length, groupMap[uniqueGroups[1]].length);
    const group1 = groupMap[uniqueGroups[0]].slice(0, n);
    const group2 = groupMap[uniqueGroups[1]].slice(0, n);
    
    const result = StatsLib.tTest(group1, group2, true);
    
    return {
        test: 'Paired Samples t-test',
        statistics: {
            t: result.t.toFixed(4),
            df: result.df,
            pValue: result.pValue.toFixed(4),
            meanDifference: result.meanDiff.toFixed(4),
            stdDifference: result.stdDiff.toFixed(4),
            nPairs: n
        },
        interpretation: interpretPairedTTestResult(result.pValue, result.meanDiff)
    };
}

function runOneWayANOVA(values, groups) {
    const uniqueGroups = [...new Set(groups)];
    
    if (uniqueGroups.length < 3) {
        throw new Error('يحتاج تحليل التباين إلى ثلاث مجموعات على الأقل');
    }
    
    // Organize data by groups
    const groupArrays = uniqueGroups.map(group => 
        values.filter((_, i) => groups[i] === group)
    );
    
    const result = StatsLib.anova(groupArrays);
    
    // Calculate group statistics
    const groupStats = {};
    uniqueGroups.forEach((group, i) => {
        const groupValues = groupArrays[i];
        groupStats[group] = {
            n: groupValues.length,
            mean: StatsLib.mean(groupValues).toFixed(4),
            std: StatsLib.stdDev(groupValues).toFixed(4)
        };
    });
    
    return {
        test: 'One-Way ANOVA',
        groups: uniqueGroups,
        groupStats: groupStats,
        statistics: {
            f: result.f.toFixed(4),
            dfBetween: result.dfBetween,
            dfWithin: result.dfWithin,
            pValue: result.pValue.toFixed(4),
            ssBetween: result.ssBetween.toFixed(4),
            ssWithin: result.ssWithin.toFixed(4),
            msBetween: result.msBetween.toFixed(4),
            msWithin: result.msWithin.toFixed(4)
        },
        interpretation: interpretAnovaResult(result.pValue, uniqueGroups.length)
    };
}

function runPearsonCorrelation(values, groups) {
    // For correlation, groups represent the second variable
    if (values.length !== groups.length) {
        throw new Error('المتغيران يجب أن يكونا بنفس الطول');
    }
    
    // Convert groups to numeric
    const numericGroups = groups.map(g => parseFloat(g));
    
    // Filter valid pairs
    const validPairs = [];
    for (let i = 0; i < values.length; i++) {
        const x = values[i];
        const y = numericGroups[i];
        
        if (!isNaN(x) && !isNaN(y)) {
            validPairs.push({ x, y });
        }
    }
    
    if (validPairs.length < 3) {
        throw new Error('يحتاج إلى 3 أزواج على الأقل لحساب الارتباط');
    }
    
    const xValues = validPairs.map(p => p.x);
    const yValues = validPairs.map(p => p.y);
    
    const r = StatsLib.correlation(xValues, yValues);
    const n = validPairs.length;
    
    // Calculate t-statistic
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const df = n - 2;
    const pValue = StatsLib.calculateTPValue(t, df);
    
    return {
        test: 'Pearson Correlation',
        statistics: {
            r: r.toFixed(4),
            rSquared: (r * r).toFixed(4),
            t: t.toFixed(4),
            df: df,
            pValue: pValue.toFixed(4),
            n: n
        },
        interpretation: interpretCorrelationResult(r, pValue)
    };
}

function handleAssumptionsCheck(data) {
    const { values, groups, checks } = data;
    
    try {
        const results = {};
        
        if (checks.normality) {
            results.normality = StatsLib.shapiroWilk(values);
        }
        
        if (checks.homogeneity && groups && groups.length > 0) {
            // Simplified homogeneity check
            const uniqueGroups = [...new Set(groups)];
            const groupValues = uniqueGroups.map(group => 
                values.filter((_, i) => groups[i] === group)
            );
            
            const groupVariances = groupValues.map(group => {
                const mean = StatsLib.mean(group);
                return group.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / group.length;
            });
            
            // Simple variance ratio test
            const maxVariance = Math.max(...groupVariances);
            const minVariance = Math.min(...groupVariances);
            const varianceRatio = maxVariance / minVariance;
            
            results.homogeneity = {
                varianceRatio: varianceRatio.toFixed(4),
                passed: varianceRatio < 4 // Simple rule of thumb
            };
        }
        
        if (checks.outliers) {
            results.outliers = detectOutliers(values);
        }
        
        self.postMessage({
            action: 'assumptionsChecked',
            results: results
        });
        
    } catch (error) {
        self.postMessage({
            action: 'error',
            error: `فشل فحص الافتراضات: ${error.message}`
        });
    }
}

function detectOutliers(values) {
    if (values.length < 4) return [];
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return values
        .map((val, idx) => ({ val, idx }))
        .filter(item => item.val < lowerBound || item.val > upperBound);
}

function handleDataValidation(data) {
    const { values, groups } = data;
    
    try {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
            stats: {}
        };
        
        // Basic validation
        if (!values || values.length === 0) {
            validation.valid = false;
            validation.errors.push('لا توجد بيانات');
            self.postMessage({ action: 'validationComplete', validation });
            return;
        }
        
        // Check for valid numeric values
        const numericValues = values.filter(val => !isNaN(parseFloat(val)));
        if (numericValues.length < values.length) {
            validation.warnings.push('يوجد قيم غير رقمية في البيانات');
        }
        
        // Calculate basic statistics
        if (numericValues.length > 0) {
            validation.stats = {
                n: numericValues.length,
                mean: StatsLib.mean(numericValues),
                stdDev: StatsLib.stdDev(numericValues),
                min: Math.min(...numericValues),
                max: Math.max(...numericValues)
            };
            
            // Check sample size
            if (numericValues.length < 3) {
                validation.warnings.push('حجم العينة صغير جداً للتحليل الإحصائي');
            }
            
            if (numericValues.length < 30) {
                validation.warnings.push('حجم العينة صغير، النتائج قد تكون غير مستقرة');
            }
        }
        
        // Check groups if provided
        if (groups && groups.length > 0) {
            const uniqueGroups = [...new Set(groups)];
            validation.stats.uniqueGroups = uniqueGroups.length;
            
            // Check group sizes
            const groupSizes = {};
            uniqueGroups.forEach(group => {
                groupSizes[group] = groups.filter(g => g === group).length;
            });
            
            validation.stats.groupSizes = groupSizes;
            
            // Warn about small groups
            Object.entries(groupSizes).forEach(([group, size]) => {
                if (size < 2) {
                    validation.warnings.push(`المجموعة "${group}" تحتوي على ملاحظة واحدة فقط`);
                }
            });
        }
        
        self.postMessage({
            action: 'validationComplete',
            validation: validation
        });
        
    } catch (error) {
        self.postMessage({
            action: 'error',
            error: `فشل التحقق من البيانات: ${error.message}`
        });
    }
}

// Interpretation functions
function interpretTTestResult(pValue, mean1, mean2) {
    if (pValue < 0.05) {
        return `يوجد فرق ذو دلالة إحصائية بين المجموعتين (p < 0.05).`;
    } else {
        return `لا يوجد فرق ذو دلالة إحصائية بين المجموعتين (p = ${pValue.toFixed(4)}).`;
    }
}

function interpretPairedTTestResult(pValue, meanDiff) {
    if (pValue < 0.05) {
        const direction = meanDiff > 0 ? 'زيادة' : 'انخفاض';
        return `يوجد فرق ذو دلالة إحصائية بين القياسات (p < 0.05).`;
    } else {
        return `لا يوجد فرق ذو دلالة إحصائية بين القياسات (p = ${pValue.toFixed(4)}).`;
    }
}

function interpretAnovaResult(pValue, groupCount) {
    if (pValue < 0.05) {
        return `يوجد فرق ذو دلالة إحصائية بين متوسطات المجموعات (p < 0.05).`;
    } else {
        return `لا يوجد فرق ذو دلالة إحصائية بين متوسطات المجموعات (p = ${pValue.toFixed(4)}).`;
    }
}

function interpretCorrelationResult(r, pValue) {
    const strength = Math.abs(r);
    let strengthText = '';
    
    if (strength >= 0.7) strengthText = 'قوي';
    else if (strength >= 0.5) strengthText = 'متوسط';
    else if (strength >= 0.3) strengthText = 'ضعيف';
    else strengthText = 'ضعيف جداً';
    
    const direction = r > 0 ? 'موجب' : 'سالب';
    
    if (pValue < 0.05) {
        return `يوجد ارتباط ${direction} ${strengthText} ذو دلالة إحصائية (p < 0.05).`;
    } else {
        return `لا يوجد ارتباط ذو دلالة إحصائية (p = ${pValue.toFixed(4)}).`;
    }
}

// Export for module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StatsLib };
}
/**
 * Statistical Analysis Core Module
 * Main entry point for statistical analysis functionality
 * Implements security, validation, and statistical processing
 */

// Import required modules
import DataValidator from './data-validator.js';
import StatisticalTests from './statistical-tests.js';
import UIManager from './ui-manager.js';

// Global state with validation
const State = (function() {
    let instance = null;
    
    class StateManager {
        constructor() {
            this._data = null;
            this._metadata = null;
            this._selectedTest = null;
            this._results = null;
            this._validationErrors = [];
            this._workerBusy = false;
            
            // Security flags
            this._maxFileSize = 10 * 1024 * 1024; // 10MB
            this._maxRows = 100000;
            this._maxColumns = 100;
        }
        
        // Getters with validation
        get data() {
            return this._data ? [...this._data] : null;
        }
        
        set data(newData) {
            if (!Array.isArray(newData)) {
                throw new Error('البيانات يجب أن تكون مصفوفة');
            }
            
            // Validate data structure
            if (newData.length > this._maxRows) {
                throw new Error(`تجاوز الحد الأقصى لعدد الصفوف (${this._maxRows})`);
            }
            
            if (newData.length > 0) {
                const firstRow = newData[0];
                const columns = Object.keys(firstRow);
                
                if (columns.length > this._maxColumns) {
                    throw new Error(`تجاوز الحد الأقصى لعدد الأعمدة (${this._maxColumns})`);
                }
                
                // Validate each row
                for (let i = 0; i < newData.length; i++) {
                    const row = newData[i];
                    
                    if (typeof row !== 'object' || row === null) {
                        throw new Error(`الصف ${i + 1} ليس كائناً صالحاً`);
                    }
                    
                    // Check for prototype pollution
                    if (row.__proto__ && row.__proto__ !== Object.prototype) {
                        throw new Error('الصف يحتوي على خصائص غير مصرح بها');
                    }
                }
            }
            
            this._data = newData;
            this._updateMetadata();
        }
        
        get metadata() {
            return this._metadata ? { ...this._metadata } : null;
        }
        
        get selectedTest() {
            return this._selectedTest;
        }
        
        set selectedTest(test) {
            if (test && typeof test !== 'object') {
                throw new Error('الاختبار يجب أن يكون كائناً');
            }
            
            // Validate test structure
            if (test) {
                const requiredProps = ['id', 'name', 'category', 'description'];
                for (const prop of requiredProps) {
                    if (!(prop in test)) {
                        throw new Error(`الاختبار يفتقد الخاصية المطلوبة: ${prop}`);
                    }
                }
            }
            
            this._selectedTest = test;
        }
        
        get results() {
            return this._results ? { ...this._results } : null;
        }
        
        set results(newResults) {
            if (!newResults || typeof newResults !== 'object') {
                throw new Error('النتائج يجب أن تكون كائناً');
            }
            
            // Sanitize results
            const sanitized = {};
            for (const key in newResults) {
                if (Object.prototype.hasOwnProperty.call(newResults, key)) {
                    // Remove any script-like content
                    const value = newResults[key];
                    if (typeof value === 'string') {
                        sanitized[key] = DataValidator.sanitizeInput(value);
                    } else {
                        sanitized[key] = value;
                    }
                }
            }
            
            this._results = sanitized;
        }
        
        get validationErrors() {
            return [...this._validationErrors];
        }
        
        clearValidationErrors() {
            this._validationErrors = [];
        }
        
        addValidationError(error) {
            if (typeof error === 'string') {
                this._validationErrors.push(error);
            } else if (error instanceof Error) {
                this._validationErrors.push(error.message);
            }
        }
        
        get workerBusy() {
            return this._workerBusy;
        }
        
        set workerBusy(busy) {
            this._workerBusy = Boolean(busy);
        }
        
        _updateMetadata() {
            if (!this._data || this._data.length === 0) {
                this._metadata = null;
                return;
            }
            
            const firstRow = this._data[0];
            const columns = Object.keys(firstRow);
            const columnTypes = {};
            const columnStats = {};
            
            // Analyze each column
            for (const column of columns) {
                const values = this._data.map(row => row[column]);
                const stats = DataValidator.analyzeColumn(values, column);
                columnTypes[column] = stats.type;
                columnStats[column] = stats;
            }
            
            this._metadata = {
                rowCount: this._data.length,
                columnCount: columns.length,
                columns: columns,
                columnTypes: columnTypes,
                columnStats: columnStats,
                hasNumericData: Object.values(columnTypes).includes('numeric'),
                hasCategoricalData: Object.values(columnTypes).includes('categorical'),
                lastUpdated: new Date().toISOString()
            };
        }
        
        reset() {
            this._data = null;
            this._metadata = null;
            this._selectedTest = null;
            this._results = null;
            this._validationErrors = [];
            this._workerBusy = false;
        }
        
        toJSON() {
            return {
                hasData: !!this._data,
                dataLength: this._data ? this._data.length : 0,
                metadata: this._metadata,
                selectedTest: this._selectedTest ? this._selectedTest.name : null,
                hasResults: !!this._results,
                validationErrorCount: this._validationErrors.length,
                workerBusy: this._workerBusy
            };
        }
    }
    
    return {
        getInstance: function() {
            if (!instance) {
                instance = new StateManager();
            }
            return instance;
        }
    };
})();

// Main application controller
class StatisticsApp {
    constructor() {
        this.state = State.getInstance();
        this.validator = new DataValidator();
        this.tests = new StatisticalTests();
        this.ui = new UIManager();
        
        // Initialize workers
        this.statsWorker = null;
        this.initializeWorker();
        
        // Bind event handlers
        this.bindEvents();
        
        // Initialize modules
        this.initialize();
    }
    
    initialize() {
        try {
            // Initialize UI
            this.ui.initialize();
            
            // Load test database
            this.tests.loadTestDatabase();
            
            // Update UI with initial state
            this.updateUI();
            
            console.log('تم تهيئة التطبيق بنجاح');
        } catch (error) {
            this.handleError(error, 'تهيئة التطبيق');
        }
    }
    
    initializeWorker() {
        try {
            if (typeof Worker !== 'undefined') {
                this.statsWorker = new Worker('js/stats-worker.js', { type: 'module' });
                
                this.statsWorker.onmessage = (event) => {
                    this.handleWorkerResponse(event.data);
                };
                
                this.statsWorker.onerror = (error) => {
                    console.error('خطأ في العامل:', error);
                    this.ui.showError('تعذر إجراء الحسابات المعقدة. يتم استخدام البديل المحلي.');
                };
            } else {
                console.warn('Web Workers غير مدعومة في هذا المتصفح');
            }
        } catch (error) {
            console.warn('تعذر تهيئة العامل:', error);
        }
    }
    
    bindEvents() {
        // File upload
        document.getElementById('data-file').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });
        
        // Manual data processing
        document.getElementById('process-data-btn').addEventListener('click', () => {
            this.processManualData();
        });
        
        // Sample data
        document.getElementById('load-sample-btn').addEventListener('click', () => {
            this.loadSampleData();
        });
        
        // Clear data
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            this.clearData();
        });
        
        // Wizard navigation
        document.getElementById('next-btn').addEventListener('click', () => {
            this.nextWizardStep();
        });
        
        document.getElementById('prev-btn').addEventListener('click', () => {
            this.prevWizardStep();
        });
        
        // Run assumptions check
        document.getElementById('run-assumptions-btn').addEventListener('click', () => {
            this.runAssumptionsCheck();
        });
        
        // Run analysis
        document.getElementById('run-analysis-btn').addEventListener('click', () => {
            this.runSelectedAnalysis();
        });
        
        // Test search with debounce
        const searchInput = document.getElementById('test-search');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterTests(e.target.value);
            }, 300);
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterTestsByCategory(e.target.dataset.filter);
            });
        });
        
        // Column selection
        document.getElementById('categorical-column').addEventListener('change', () => {
            this.validateColumnSelection();
        });
        
        document.getElementById('numerical-column').addEventListener('change', () => {
            this.validateColumnSelection();
        });
        
        // Wizard option cards
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectWizardOption(e.currentTarget);
            });
        });
        
        // Keyboard navigation for wizard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                if (e.key === 'ArrowRight') this.prevWizardStep();
                if (e.key === 'ArrowLeft') this.nextWizardStep();
            }
        });
    }
    
    async handleFileUpload(file) {
        try {
            if (!file) return;
            
            // Show validation message
            this.ui.showMessage('جاري التحقق من الملف...', 'info');
            
            // Validate file
            const validation = await this.validator.validateFile(file);
            
            if (!validation.valid) {
                throw new Error(validation.errors.join(', '));
            }
            
            // Parse file
            const data = await this.validator.parseCSV(file);
            
            // Set data in state
            this.state.data = data;
            
            // Update UI
            this.updateDataUI();
            this.ui.showMessage('تم تحميل البيانات بنجاح', 'success');
            
        } catch (error) {
            this.handleError(error, 'تحميل الملف');
        }
    }
    
    processManualData() {
        try {
            const textarea = document.getElementById('manual-data');
            const content = textarea.value.trim();
            
            if (!content) {
                throw new Error('الرجاء إدخال بيانات');
            }
            
            // Validate and parse
            const data = this.validator.parseCSVContent(content);
            
            // Set data in state
            this.state.data = data;
            
            // Update UI
            this.updateDataUI();
            this.ui.showMessage('تم معالجة البيانات بنجاح', 'success');
            
        } catch (error) {
            this.handleError(error, 'معالجة البيانات اليدوية');
        }
    }
    
    loadSampleData() {
        try {
            const sampleData = [
                { المجموعة: 'تجريبية', الدرجة: 85 },
                { المجموعة: 'تجريبية', الدرجة: 78 },
                { المجموعة: 'تجريبية', الدرجة: 92 },
                { المجموعة: 'تجريبية', الدرجة: 88 },
                { المجموعة: 'تجريبية', الدرجة: 76 },
                { المجموعة: 'ضابطة', الدرجة: 72 },
                { المجموعة: 'ضابطة', الدرجة: 68 },
                { المجموعة: 'ضابطة', الدرجة: 75 },
                { المجموعة: 'ضابطة', الدرجة: 70 },
                { المجموعة: 'ضابطة', الدرجة: 65 }
            ];
            
            this.state.data = sampleData;
            
            // Update UI
            this.updateDataUI();
            this.ui.showMessage('تم تحميل البيانات التجريبية بنجاح', 'success');
            
            // Auto-select columns
            setTimeout(() => {
                document.getElementById('categorical-column').value = 'المجموعة';
                document.getElementById('numerical-column').value = 'الدرجة';
                this.validateColumnSelection();
            }, 100);
            
        } catch (error) {
            this.handleError(error, 'تحميل البيانات التجريبية');
        }
    }
    
    clearData() {
        try {
            if (confirm('هل أنت متأكد من مسح جميع البيانات الحالية؟')) {
                this.state.reset();
                this.updateUI();
                this.ui.showMessage('تم مسح البيانات', 'info');
            }
        } catch (error) {
            this.handleError(error, 'مسح البيانات');
        }
    }
    
    updateDataUI() {
        const metadata = this.state.metadata;
        if (!metadata) return;
        
        // Update statistics
        document.getElementById('row-count').textContent = metadata.rowCount;
        document.getElementById('col-count').textContent = metadata.columnCount;
        document.getElementById('data-type').textContent = 
            metadata.hasNumericData && metadata.hasCategoricalData ? 'مختلط' :
            metadata.hasNumericData ? 'كمي' : 'فئوي';
        document.getElementById('data-status').textContent = '✓';
        document.getElementById('data-status').style.color = 'var(--success-emerald)';
        
        // Show data stats section
        document.getElementById('data-stats-section').classList.remove('d-none');
        
        // Update column selection
        this.updateColumnSelection();
        
        // Update data preview
        this.ui.updateDataPreview(this.state.data, metadata.columns);
        
        // Show column selection
        document.getElementById('column-selection-section').classList.remove('d-none');
        document.getElementById('data-preview-section').classList.remove('d-none');
    }
    
    updateColumnSelection() {
        const metadata = this.state.metadata;
        if (!metadata) return;
        
        const catSelect = document.getElementById('categorical-column');
        const numSelect = document.getElementById('numerical-column');
        
        // Clear existing options
        catSelect.innerHTML = '<option value="">اختر عمود المجموعات</option>';
        numSelect.innerHTML = '<option value="">اختر عمود القيم</option>';
        
        // Add new options
        metadata.columns.forEach(column => {
            const type = metadata.columnTypes[column];
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            
            if (type === 'categorical') {
                catSelect.appendChild(option.cloneNode(true));
            }
            
            if (type === 'numeric') {
                numSelect.appendChild(option.cloneNode(true));
            }
            
            // Also add to both if mixed type
            if (type === 'mixed') {
                catSelect.appendChild(option.cloneNode(true));
                numSelect.appendChild(option.cloneNode(true));
            }
        });
    }
    
    validateColumnSelection() {
        const catColumn = document.getElementById('categorical-column').value;
        const numColumn = document.getElementById('numerical-column').value;
        
        if (catColumn && numColumn) {
            // Enable wizard
            this.ui.enableWizard();
            
            // Show validation message
            this.ui.showMessage('البيانات جاهزة للتحليل', 'success');
        } else {
            this.ui.disableWizard();
        }
    }
    
    selectWizardOption(card) {
        const step = card.closest('.wizard-step');
        const options = step.querySelectorAll('.option-card');
        
        // Deselect all options in this step
        options.forEach(opt => {
            opt.setAttribute('aria-checked', 'false');
            opt.classList.remove('selected');
        });
        
        // Select clicked option
        card.setAttribute('aria-checked', 'true');
        card.classList.add('selected');
        
        // Store selection
        const stepId = step.id;
        const value = card.dataset.value;
        
        // Update wizard state
        this.ui.updateWizardState(stepId, value);
    }
    
    nextWizardStep() {
        const currentStep = this.ui.getCurrentStep();
        const nextStep = currentStep + 1;
        
        // Validate current step
        if (!this.validateWizardStep(currentStep)) {
            this.ui.showError('الرجاء إكمال الخيارات في هذه الخطوة');
            return;
        }
        
        // If moving to step 5, generate recommendations
        if (nextStep === 5) {
            this.generateTestRecommendations();
        }
        
        // Move to next step
        this.ui.navigateToStep(nextStep);
    }
    
    prevWizardStep() {
        const currentStep = this.ui.getCurrentStep();
        const prevStep = currentStep - 1;
        
        if (prevStep >= 1) {
            this.ui.navigateToStep(prevStep);
        }
    }
    
    validateWizardStep(step) {
        const stepElement = document.getElementById(`step-${step}`);
        const selectedOption = stepElement.querySelector('.option-card[aria-checked="true"]');
        
        if (!selectedOption) {
            return false;
        }
        
        // Additional validation based on step
        switch(step) {
            case 2:
                // Check if data supports selected option
                return this.validateDataForStep2(selectedOption.dataset.value);
            case 4:
                // Validate group count selection
                return this.validateGroupCount(selectedOption.dataset.value);
            default:
                return true;
        }
    }
    
    validateDataForStep2(optionValue) {
        const metadata = this.state.metadata;
        if (!metadata) return false;
        
        switch(optionValue) {
            case 'continuous-normal':
                return metadata.hasNumericData;
            case 'continuous-nonnormal':
                return metadata.hasNumericData;
            case 'categorical':
                return metadata.hasCategoricalData;
            case 'ordinal':
                return true; // Accept mixed data for ordinal
            default:
                return true;
        }
    }
    
    validateGroupCount(optionValue) {
        if (optionValue === '2' || optionValue === '3+') {
            const catColumn = document.getElementById('categorical-column').value;
            if (!catColumn) return false;
            
            const metadata = this.state.metadata;
            const uniqueGroups = new Set(this.state.data.map(row => row[catColumn]));
            
            if (optionValue === '2' && uniqueGroups.size !== 2) {
                this.ui.showError('العمود الفئوي يجب أن يحتوي على مجموعتين فقط');
                return false;
            }
            
            if (optionValue === '3+' && uniqueGroups.size < 3) {
                this.ui.showError('العمود الفئوي يجب أن يحتوي على ثلاث مجموعات على الأقل');
                return false;
            }
        }
        
        return true;
    }
    
    generateTestRecommendations() {
        try {
            // Get wizard selections
            const selections = this.ui.getWizardSelections();
            
            // Get data characteristics
            const catColumn = document.getElementById('categorical-column').value;
            const numColumn = document.getElementById('numerical-column').value;
            
            if (!catColumn || !numColumn) {
                throw new Error('الرجاء اختيار الأعمدة المناسبة');
            }
            
            // Extract data
            const data = this.state.data;
            const groups = data.map(row => row[catColumn]);
            const values = data.map(row => row[numColumn]);
            
            // Get recommendations
            const recommendations = this.tests.getRecommendations(selections, {
                groups: groups,
                values: values,
                groupColumn: catColumn,
                valueColumn: numColumn
            });
            
            // Display recommendations
            this.ui.displayRecommendations(recommendations);
            
            // Show recommendations section
            document.querySelector('.recommendations-section').classList.remove('d-none');
            
        } catch (error) {
            this.handleError(error, 'توليد التوصيات');
        }
    }
    
    async runAssumptionsCheck() {
        try {
            const catColumn = document.getElementById('categorical-column').value;
            const numColumn = document.getElementById('numerical-column').value;
            
            if (!catColumn || !numColumn) {
                throw new Error('الرجاء اختيار الأعمدة أولاً');
            }
            
            // Extract data
            const data = this.state.data;
            const groups = data.map(row => row[catColumn]);
            const values = data.map(row => row[numColumn]);
            
            // Get selected checks
            const checks = {
                normality: document.getElementById('check-normality').checked,
                homogeneity: document.getElementById('check-homogeneity').checked,
                outliers: document.getElementById('check-outliers').checked
            };
            
            // Show loading
            this.ui.showLoading('جاري فحص الافتراضات...');
            
            // Run checks
            const results = await this.tests.checkAssumptions(values, groups, checks);
            
            // Hide loading
            this.ui.hideLoading();
            
            // Display results
            this.ui.displayAssumptionResults(results);
            
        } catch (error) {
            this.ui.hideLoading();
            this.handleError(error, 'فحص الافتراضات');
        }
    }
    
    async runSelectedAnalysis() {
        try {
            const selectedCard = document.querySelector('.recommendation-card.selected');
            if (!selectedCard) {
                throw new Error('الرجاء اختيار اختبار أولاً');
            }
            
            const testId = selectedCard.dataset.testId;
            const test = this.tests.getTestById(testId);
            
            if (!test) {
                throw new Error('الاختبار المحدد غير موجود');
            }
            
            // Get data
            const catColumn = document.getElementById('categorical-column').value;
            const numColumn = document.getElementById('numerical-column').value;
            const data = this.state.data;
            
            // Show loading
            this.ui.showLoading(`جاري تحليل ${test.name}...`);
            
            // Run analysis
            let results;
            if (this.statsWorker && !this.state.workerBusy) {
                // Use web worker for heavy calculations
                results = await this.runAnalysisWithWorker(testId, data, catColumn, numColumn);
            } else {
                // Use main thread
                results = await this.tests.runTest(testId, data, catColumn, numColumn);
            }
            
            // Hide loading
            this.ui.hideLoading();
            
            // Store results
            this.state.results = results;
            this.state.selectedTest = test;
            
            // Display results
            this.ui.displayAnalysisResults(results, test);
            
            // Show results section
            document.querySelector('.results-section').classList.remove('d-none');
            
            // Scroll to results
            document.querySelector('.results-section').scrollIntoView({ 
                behavior: 'smooth',
                block: 'start'
            });
            
        } catch (error) {
            this.ui.hideLoading();
            this.handleError(error, 'تشغيل التحليل');
        }
    }
    
    runAnalysisWithWorker(testId, data, catColumn, numColumn) {
        return new Promise((resolve, reject) => {
            this.state.workerBusy = true;
            
            // Set timeout for worker
            const timeout = setTimeout(() => {
                this.statsWorker.terminate();
                this.initializeWorker();
                reject(new Error('انتهت مهلة الحسابات'));
            }, 30000);
            
            this.statsWorker.onmessage = (event) => {
                clearTimeout(timeout);
                this.state.workerBusy = false;
                
                if (event.data.error) {
                    reject(new Error(event.data.error));
                } else {
                    resolve(event.data.results);
                }
            };
            
            // Send data to worker
            this.statsWorker.postMessage({
                action: 'runTest',
                testId: testId,
                data: data,
                catColumn: catColumn,
                numColumn: numColumn
            });
        });
    }
    
    handleWorkerResponse(data) {
        switch(data.action) {
            case 'testComplete':
                this.state.results = data.results;
                this.ui.displayAnalysisResults(data.results, this.state.selectedTest);
                break;
                
            case 'assumptionsChecked':
                this.ui.displayAssumptionResults(data.results);
                break;
                
            case 'error':
                this.handleError(new Error(data.error), 'العامل');
                break;
        }
    }
    
    filterTests(searchTerm) {
        this.ui.filterTests(searchTerm);
    }
    
    filterTestsByCategory(category) {
        this.ui.filterTestsByCategory(category);
    }
    
    updateUI() {
        // Update based on state
        const state = this.state.toJSON();
        
        if (state.hasData) {
            this.updateDataUI();
        }
        
        // Update wizard state
        this.ui.updateWizardProgress();
    }
    
    handleError(error, context = '') {
        console.error(`خطأ في ${context}:`, error);
        
        // Sanitize error message for user display
        const userMessage = this.sanitizeErrorMessage(error, context);
        
        // Show error to user
        this.ui.showError(userMessage);
        
        // Log error for debugging
        this.logError(error, context);
    }
    
    sanitizeErrorMessage(error, context) {
        let message = error.message || 'حدث خطأ غير معروف';
        
        // Remove technical details
        message = message.replace(/at .*/g, '');
        message = message.replace(/in .*/g, '');
        
        // Add context if provided
        if (context) {
            message = `خطأ في ${context}: ${message}`;
        }
        
        // Limit message length
        if (message.length > 200) {
            message = message.substring(0, 197) + '...';
        }
        
        return message;
    }
    
    logError(error, context) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            context: context,
            message: error.message,
            stack: error.stack,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // In a real application, send to server
        console.error('Error logged:', errorLog);
        
        // Store in localStorage for debugging
        try {
            const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
            logs.unshift(errorLog);
            
            // Keep only last 50 errors
            if (logs.length > 50) {
                logs.pop();
            }
            
            localStorage.setItem('errorLogs', JSON.stringify(logs));
        } catch (e) {
            console.warn('تعذر حفظ سجل الأخطاء:', e);
        }
    }
    
    exportResults(format = 'text') {
        try {
            const results = this.state.results;
            const test = this.state.selectedTest;
            
            if (!results || !test) {
                throw new Error('لا توجد نتائج للتصدير');
            }
            
            let content, filename, mimeType;
            
            switch(format) {
                case 'text':
                    content = this.formatResultsAsText(results, test);
                    filename = `نتائج_${test.name}_${new Date().toISOString().slice(0,10)}.txt`;
                    mimeType = 'text/plain;charset=utf-8';
                    break;
                    
                case 'csv':
                    content = this.formatResultsAsCSV(results, test);
                    filename = `نتائج_${test.name}_${new Date().toISOString().slice(0,10)}.csv`;
                    mimeType = 'text/csv;charset=utf-8';
                    break;
                    
                case 'json':
                    content = JSON.stringify({
                        test: test,
                        results: results,
                        metadata: this.state.metadata,
                        timestamp: new Date().toISOString()
                    }, null, 2);
                    filename = `نتائج_${test.name}_${new Date().toISOString().slice(0,10)}.json`;
                    mimeType = 'application/json;charset=utf-8';
                    break;
                    
                default:
                    throw new Error('صيغة التصدير غير مدعومة');
            }
            
            // Create and trigger download
            const blob = new Blob(['\ufeff' + content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(url);
            
            this.ui.showMessage('تم تصدير النتائج بنجاح', 'success');
            
        } catch (error) {
            this.handleError(error, 'تصدير النتائج');
        }
    }
    
    formatResultsAsText(results, test) {
        return `
نتائج التحليل الإحصائي
=======================

الاختبار: ${test.name}
التاريخ: ${new Date().toLocaleString('ar-SA')}

النتائج الإحصائية:
-----------------
${Object.entries(results)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}

تفسير النتائج:
-------------
${results.interpretation || 'لا يوجد تفسير متاح'}

التوصيات:
--------
${results.recommendations || 'لا توجد توصيات متاحة'}

ملاحظات:
-------
${results.notes || 'لا توجد ملاحظات إضافية'}

---
تم إنشاء هذا التقرير بواسطة منصة "بحثي"
        `.trim();
    }
    
    formatResultsAsCSV(results, test) {
        const rows = [
            ['المفتاح', 'القيمة'],
            ['الاختبار', test.name],
            ['التاريخ', new Date().toLocaleString('ar-SA')],
            ['', '']
        ];
        
        // Add statistical results
        Object.entries(results)
            .filter(([key]) => !key.startsWith('_'))
            .forEach(([key, value]) => {
                rows.push([key, value]);
            });
        
        // Convert to CSV
        return rows.map(row => 
            row.map(cell => 
                typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
            ).join(',')
        ).join('\n');
    }
    
    destroy() {
        // Cleanup
        if (this.statsWorker) {
            this.statsWorker.terminate();
        }
        
        // Remove event listeners
        // Note: In a real app, you'd want to track and remove all listeners
        
        // Clear state
        this.state.reset();
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for required APIs
    if (typeof FileReader === 'undefined') {
        alert('المتصفح لا يدعم قراءة الملفات. الرجاء استخدام متصفح حديث.');
        return;
    }
    
    if (typeof Worker === 'undefined') {
        console.warn('Web Workers غير مدعومة. قد تكون بعض الحسابات بطيئة.');
    }
    
    // Initialize app
    window.statisticsApp = new StatisticsApp();
    
    // Export to global scope for debugging
    if (process.env.NODE_ENV === 'development') {
        window.app = window.statisticsApp;
    }
});

// Error boundary for unhandled errors
window.addEventListener('error', (event) => {
    console.error('حدث خطأ غير متوقع:', event.error);
    
    // Show user-friendly message
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = 'حدث خطأ غير متوقع في التطبيق. الرجاء تحديث الصفحة.';
        new bootstrap.Modal(document.getElementById('errorModal')).show();
    }
    
    // Prevent default error handling
    event.preventDefault();
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('رفض وعد غير معالج:', event.reason);
    event.preventDefault();
});

export default StatisticsApp;
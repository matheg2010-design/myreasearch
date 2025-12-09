/**
 * UI Manager Module
 * Handles all UI updates and interactions
 */

class UIManager {
    constructor() {
        this.currentWizardStep = 1;
        this.wizardSelections = {};
        this.debounceTimers = {};
    }
    
    initialize() {
        this.initializeAccessibility();
        this.initializeEventListeners();
        this.initializeTestDatabase();
        this.updateUI();
    }
    
    initializeAccessibility() {
        // Add skip link
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'انتقال إلى المحتوى الرئيسي';
        document.body.prepend(skipLink);
        
        // Add ARIA attributes
        const mainContent = document.querySelector('main') || document.querySelector('.container');
        if (mainContent) {
            mainContent.id = 'main-content';
            mainContent.tabIndex = -1;
        }
        
        // Make all interactive elements keyboard accessible
        document.querySelectorAll('button, [role="button"]').forEach(button => {
            if (!button.hasAttribute('tabindex')) {
                button.setAttribute('tabindex', '0');
            }
        });
        
        // Add focus styles
        const style = document.createElement('style');
        style.textContent = `
            *:focus {
                outline: 3px solid var(--secondary-gold) !important;
                outline-offset: 2px !important;
            }
            
            .skip-link:focus {
                position: absolute !important;
                top: 10px !important;
                left: 10px !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    initializeEventListeners() {
        // Test card interactions
        document.addEventListener('click', (e) => {
            const testCard = e.target.closest('.test-card');
            if (testCard) {
                this.handleTestCardClick(testCard);
            }
            
            const recommendationCard = e.target.closest('.recommendation-card');
            if (recommendationCard) {
                this.handleRecommendationCardClick(recommendationCard);
            }
        });
        
        // Keyboard navigation for cards
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const activeElement = document.activeElement;
                
                if (activeElement.classList.contains('option-card')) {
                    e.preventDefault();
                    this.selectWizardOption(activeElement);
                }
                
                if (activeElement.closest('.test-card')) {
                    e.preventDefault();
                    this.handleTestCardClick(activeElement.closest('.test-card'));
                }
            }
        });
    }
    
    initializeTestDatabase() {
        // This will be populated by the main app
    }
    
    updateUI() {
        this.updateWizardProgress();
        this.updateDataPreview();
        this.updateValidationResults();
    }
    
    updateDataPreview(data, columns) {
        const previewSection = document.getElementById('data-preview-section');
        const table = document.getElementById('data-table');
        
        if (!data || !columns) {
            previewSection.classList.add('d-none');
            return;
        }
        
        // Clear existing table
        table.innerHTML = '';
        
        // Create header row
        const headerRow = document.createElement('tr');
        columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            th.setAttribute('scope', 'col');
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);
        
        // Create data rows (first 10 rows)
        const rowsToShow = Math.min(data.length, 10);
        for (let i = 0; i < rowsToShow; i++) {
            const dataRow = document.createElement('tr');
            columns.forEach(column => {
                const td = document.createElement('td');
                td.textContent = data[i][column] || '';
                dataRow.appendChild(td);
            });
            table.appendChild(dataRow);
        }
        
        // Add note if there are more rows
        if (data.length > 10) {
            const noteRow = document.createElement('tr');
            const noteCell = document.createElement('td');
            noteCell.colSpan = columns.length;
            noteCell.className = 'text-center text-muted';
            noteCell.textContent = `... وإظهار ${data.length - 10} صف إضافي`;
            noteRow.appendChild(noteCell);
            table.appendChild(noteRow);
        }
        
        // Show preview section
        previewSection.classList.remove('d-none');
    }
    
    updateWizardProgress() {
        const progressBar = document.querySelector('.progress-bar');
        const progressText = document.getElementById('progress-text');
        
        if (progressBar && progressText) {
            const progress = (this.currentWizardStep / 5) * 100;
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
            progressText.textContent = `الخطوة ${this.currentWizardStep} من 5`;
        }
        
        // Update step indicators
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            if (index + 1 === this.currentWizardStep) {
                indicator.classList.add('active');
                indicator.setAttribute('aria-current', 'step');
            } else {
                indicator.classList.remove('active');
                indicator.removeAttribute('aria-current');
            }
        });
    }
    
    updateWizardState(stepId, value) {
        const stepNumber = stepId.split('-')[1];
        this.wizardSelections[`step${stepNumber}`] = value;
    }
    
    getWizardSelections() {
        return {
            design: this.wizardSelections.step1,
            characteristics: this.wizardSelections.step2,
            samples: this.wizardSelections.step3,
            groups: this.wizardSelections.step4
        };
    }
    
    getCurrentStep() {
        return this.currentWizardStep;
    }
    
    navigateToStep(step) {
        if (step < 1 || step > 5) return;
        
        // Hide current step
        document.getElementById(`step-${this.currentWizardStep}`).classList.remove('active');
        
        // Show new step
        this.currentWizardStep = step;
        document.getElementById(`step-${step}`).classList.add('active');
        
        // Update navigation buttons
        this.updateNavigationButtons();
        
        // Update progress
        this.updateWizardProgress();
        
        // Focus first element in new step
        setTimeout(() => {
            const firstFocusable = document.querySelector(`#step-${step} .option-card`);
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }, 100);
    }
    
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        if (prevBtn) {
            prevBtn.style.display = this.currentWizardStep > 1 ? 'inline-block' : 'none';
        }
        
        if (nextBtn) {
            nextBtn.style.display = this.currentWizardStep < 5 ? 'inline-block' : 'none';
        }
        
        // Update finish button if on last step
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.style.display = this.currentWizardStep === 5 ? 'inline-block' : 'none';
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
    }
    
    enableWizard() {
        document.getElementById('next-btn').disabled = false;
        document.querySelectorAll('.option-card').forEach(card => {
            card.disabled = false;
        });
    }
    
    disableWizard() {
        document.getElementById('next-btn').disabled = true;
        document.querySelectorAll('.option-card').forEach(card => {
            card.disabled = true;
        });
    }
    
    displayRecommendations(recommendations) {
        const container = document.getElementById('recommendations-grid');
        if (!container) return;
        
        container.innerHTML = '';
        
        recommendations.forEach((rec, index) => {
            const test = rec.test;
            const card = document.createElement('div');
            card.className = `recommendation-card ${index === 0 ? 'selected' : ''}`;
            card.dataset.testId = test.id;
            
            card.innerHTML = `
                <div class="recommendation-card-header">
                    <div class="recommendation-icon">
                        <i class="${test.icon}"></i>
                    </div>
                    <h5>${test.name}<span class="recommendation-badge">${rec.suitability}</span></h5>
                </div>
                <p>${test.description}</p>
                <div class="recommendation-conditions">
                    <h6>الشروط:</h6>
                    <ul>
                        ${test.conditions.map(cond => `<li>${cond}</li>`).join('')}
                    </ul>
                </div>
                <div class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="statisticsApp.viewTestDetails('${test.id}')">
                        <i class="fas fa-info-circle me-2"></i>تفاصيل أكثر
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
        
        // Show recommendations section
        document.querySelector('.recommendations-section').classList.remove('d-none');
    }
    
    handleRecommendationCardClick(card) {
        // Deselect all cards
        document.querySelectorAll('.recommendation-card').forEach(c => {
            c.classList.remove('selected');
        });
        
        // Select clicked card
        card.classList.add('selected');
    }
    
    displayAssumptionResults(results) {
        const container = document.getElementById('assumption-results');
        if (!container) return;
        
        let html = '<h6 class="arabic-heading mb-3">نتائج الفحص:</h6>';
        
        Object.entries(results).forEach(([key, result]) => {
            if (!result) return;
            
            html += `
                <div class="assumption-result-item">
                    <span class="assumption-result-name">${result.test}:</span>
                    <span class="assumption-result-value ${result.passed ? 'pass' : 'fail'}">
                        ${result.result}
                    </span>
                </div>
            `;
        });
        
        container.innerHTML = html;
        container.classList.remove('d-none');
    }
    
    displayAnalysisResults(results, test) {
        const container = document.querySelector('.results-container');
        if (!container) return;
        
        let html = `
            <div class="results-header">
                <h4 class="arabic-heading">${test.name}</h4>
                <div class="btn-group">
                    <button class="btn btn-outline-primary" onclick="statisticsApp.exportResults('text')">
                        <i class="fas fa-file-text me-2"></i>نص
                    </button>
                    <button class="btn btn-outline-primary" onclick="statisticsApp.exportResults('csv')">
                        <i class="fas fa-file-csv me-2"></i>CSV
                    </button>
                    <button class="btn btn-outline-primary" onclick="statisticsApp.exportResults('json')">
                        <i class="fas fa-file-code me-2"></i>JSON
                    </button>
                </div>
            </div>
            
            <div class="results-grid">
        `;
        
        // Add statistical results
        if (results.statistics) {
            Object.entries(results.statistics).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    const label = this.translateStatistic(key);
                    html += `
                        <div class="result-stat-card">
                            <div class="stat-label">${label}</div>
                            <div class="stat-value">${value}</div>
                        </div>
                    `;
                }
            });
        }
        
        html += `</div>`;
        
        // Add interpretation
        if (results.interpretation) {
            html += `
                <div class="interpretation-box">
                    <h5 class="arabic-heading">تفسير النتائج:</h5>
                    <div class="interpretation-content">${results.interpretation}</div>
                </div>
            `;
        }
        
        // Add recommendations
        if (results.recommendations) {
            html += `
                <div class="recommendation-box">
                    <h5 class="arabic-heading">التوصيات:</h5>
                    <ul>
                        ${results.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Add chart container
        html += `
            <div class="chart-container">
                <canvas id="results-chart"></canvas>
                <div class="chart-fallback d-none">
                    <i class="fas fa-chart-line"></i>
                    <p>تعذر تحميل الرسم البياني</p>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Create chart
        this.createResultsChart(results, test);
        
        // Show results section
        document.querySelector('.results-section').classList.remove('d-none');
    }
    
    createResultsChart(results, test) {
        const canvas = document.getElementById('results-chart');
        if (!canvas) return;
        
        try {
            const ctx = canvas.getContext('2d');
            
            // Destroy existing chart if it exists
            if (window.resultsChart) {
                window.resultsChart.destroy();
            }
            
            // Create chart based on test type
            let chartData, chartOptions;
            
            if (results.groupStats) {
                // For tests with group comparisons
                const groups = Object.keys(results.groupStats);
                const means = groups.map(group => parseFloat(results.groupStats[group].mean));
                
                chartData = {
                    labels: groups,
                    datasets: [{
                        label: 'المتوسطات',
                        data: means,
                        backgroundColor: this.generateColors(groups.length),
                        borderColor: this.generateColors(groups.length, 1),
                        borderWidth: 2
                    }]
                };
                
                chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            rtl: true,
                            labels: {
                                font: {
                                    family: 'Cairo, sans-serif'
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'متوسطات المجموعات',
                            font: {
                                family: 'Amiri, serif',
                                size: 16
                            }
                        },
                        tooltip: {
                            rtl: true,
                            titleFont: {
                                family: 'Cairo, sans-serif'
                            },
                            bodyFont: {
                                family: 'Cairo, sans-serif'
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'القيمة',
                                font: {
                                    family: 'Cairo, sans-serif'
                                }
                            },
                            ticks: {
                                font: {
                                    family: 'Cairo, sans-serif'
                                }
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'المجموعات',
                                font: {
                                    family: 'Cairo, sans-serif'
                                }
                            },
                            ticks: {
                                font: {
                                    family: 'Cairo, sans-serif'
                                }
                            }
                        }
                    }
                };
                
            } else if (results.statistics && results.statistics.r !== undefined) {
                // For correlation tests
                const r = parseFloat(results.statistics.r);
                const ciLower = parseFloat(results.confidenceInterval?.lower || r - 0.1);
                const ciUpper = parseFloat(results.confidenceInterval?.upper || r + 0.1);
                
                chartData = {
                    labels: ['معامل الارتباط', 'فاصل الثقة 95%'],
                    datasets: [{
                        label: 'النتائج',
                        data: [r, ciUpper - ciLower],
                        backgroundColor: ['rgba(214, 158, 46, 0.8)', 'rgba(26, 54, 93, 0.3)'],
                        borderColor: ['rgba(214, 158, 46, 1)', 'rgba(26, 54, 93, 0.5)'],
                        borderWidth: 2
                    }]
                };
                
                chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                        legend: {
                            position: 'top',
                            rtl: true
                        },
                        title: {
                            display: true,
                            text: 'معامل الارتباط وفاصل الثقة',
                            font: {
                                family: 'Amiri, serif',
                                size: 16
                            }
                        }
                    }
                };
                
            } else {
                // Default chart
                const significant = results.statistics?.pValue < 0.05;
                
                chartData = {
                    labels: ['قيمة P', 'المستوى الدلالي (0.05)'],
                    datasets: [{
                        label: 'الدلالة الإحصائية',
                        data: [
                            parseFloat(results.statistics?.pValue || 0.5),
                            0.05
                        ],
                        backgroundColor: [
                            significant ? 'rgba(56, 161, 105, 0.8)' : 'rgba(220, 53, 69, 0.8)',
                            'rgba(108, 117, 125, 0.8)'
                        ],
                        borderColor: [
                            significant ? 'rgba(56, 161, 105, 1)' : 'rgba(220, 53, 69, 1)',
                            'rgba(108, 117, 125, 1)'
                        ],
                        borderWidth: 2
                    }]
                };
                
                chartOptions = {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                            rtl: true
                        },
                        title: {
                            display: true,
                            text: 'النتائج الإحصائية',
                            font: {
                                family: 'Amiri, serif',
                                size: 16
                            }
                        }
                    }
                };
            }
            
            // Create chart with RTL support
            window.resultsChart = new Chart(ctx, {
                type: 'bar',
                data: chartData,
                options: chartOptions
            });
            
        } catch (error) {
            console.error('Error creating chart:', error);
            canvas.classList.add('d-none');
            canvas.parentElement.querySelector('.chart-fallback').classList.remove('d-none');
        }
    }
    
    generateColors(count, alpha = 0.8) {
        const colors = [
            'rgba(214, 158, 46, ALPHA)',  // Gold
            'rgba(26, 54, 93, ALPHA)',    // Navy
            'rgba(56, 161, 105, ALPHA)',  // Emerald
            'rgba(220, 53, 69, ALPHA)',   // Red
            'rgba(13, 202, 240, ALPHA)',  // Blue
            'rgba(111, 66, 193, ALPHA)',  // Purple
            'rgba(253, 126, 20, ALPHA)',  // Orange
            'rgba(32, 201, 151, ALPHA)',  // Teal
            'rgba(233, 30, 99, ALPHA)',   // Pink
            'rgba(0, 150, 136, ALPHA)'    // Cyan
        ];
        
        return colors.slice(0, count).map(color => color.replace('ALPHA', alpha));
    }
    
    translateStatistic(key) {
        const translations = {
            't': 'قيمة T',
            'f': 'قيمة F',
            'chiSquare': 'قيمة مربع كاي',
            'u': 'قيمة U',
            'h': 'قيمة H',
            'z': 'قيمة Z',
            'r': 'معامل الارتباط',
            'rho': 'معامل سبيرمان',
            'pValue': 'قيمة P',
            'df': 'درجات الحرية',
            'mean': 'المتوسط',
            'std': 'الانحراف المعياري',
            'n': 'حجم العينة',
            'rSquared': 'معامل التحديد'
        };
        
        return translations[key] || key;
    }
    
    filterTests(searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const testCards = document.querySelectorAll('.test-card');
        
        testCards.forEach(card => {
            const title = card.querySelector('.test-title').textContent.toLowerCase();
            const description = card.querySelector('.test-description').textContent.toLowerCase();
            
            if (title.includes(searchLower) || description.includes(searchLower)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    filterTestsByCategory(category) {
        const testCards = document.querySelectorAll('.test-card');
        const filterButtons = document.querySelectorAll('.filter-btn');
        
        // Update active filter button
        filterButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === category) {
                btn.classList.add('active');
            }
        });
        
        // Filter test cards
        testCards.forEach(card => {
            const testCategory = card.dataset.category;
            
            if (category === 'all' || testCategory === category) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    handleTestCardClick(card) {
        const testId = card.dataset.testId;
        if (testId) {
            // Show tutorial modal
            this.showTutorialModal(testId);
        }
    }
    
    showTutorialModal(testId) {
        // This would be implemented to show detailed test information
        console.log('Showing tutorial for test:', testId);
    }
    
    showMessage(message, type = 'info') {
        const container = document.getElementById('validation-results');
        if (!container) return;
        
        const alertClass = {
            'info': 'alert-info',
            'success': 'alert-success',
            'warning': 'alert-warning',
            'error': 'alert-danger'
        }[type] || 'alert-info';
        
        const icon = {
            'info': 'fa-info-circle',
            'success': 'fa-check-circle',
            'warning': 'fa-exclamation-triangle',
            'error': 'fa-exclamation-circle'
        }[type] || 'fa-info-circle';
        
        container.innerHTML = `
            <div class="alert ${alertClass} d-flex align-items-center">
                <i class="fas ${icon} me-3 fa-lg"></i>
                <div>${message}</div>
            </div>
        `;
        
        container.classList.remove('d-none');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            container.classList.add('d-none');
        }, 5000);
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showLoading(message = 'جاري المعالجة...') {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="text-center">
                <div class="loading-spinner"></div>
                <div class="loading-text mt-3">${message}</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        overlay.style.display = 'flex';
    }
    
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    updateValidationResults() {
        // This would update validation results based on data validation
    }
    
    debounce(func, wait) {
        const key = func.name || 'anonymous';
        
        return (...args) => {
            if (this.debounceTimers[key]) {
                clearTimeout(this.debounceTimers[key]);
            }
            
            this.debounceTimers[key] = setTimeout(() => {
                func(...args);
            }, wait);
        };
    }
}

export default UIManager;
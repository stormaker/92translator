class TranslatorApp {
    constructor() {
        this.apiKey = localStorage.getItem('dashscope_api_key') || '';
        this.settings = {
            autoTranslate: localStorage.getItem('autoTranslate') === 'true',
            saveHistory: localStorage.getItem('saveHistory') !== 'false',
            theme: localStorage.getItem('theme') || 'light'
        };
        this.history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        this.autoTranslateTimer = null;
        
        // 语言映射
        this.languageMap = {
            'auto': '自动检测',
            'Chinese': '中文',
            'English': '英文',
            'Russian': '俄语',
            'Japanese': '日语',
            'French': '法语',
            'German': '德语',
            'Spanish': '西班牙语',
            'Portuguese': '葡萄牙语',
            'Thai': '泰语',
            'Vietnamese': '越南语',
            'Malay': '马来语'
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadSettings();
        this.renderHistory();
        this.updateLanguageLabels();
    }

    initializeElements() {
        // 主要元素
        this.inputText = document.getElementById('inputText');
        this.outputText = document.getElementById('outputText');
        this.translateBtn = document.getElementById('translateBtn');
        this.charCount = document.getElementById('charCount');
        this.loading = document.getElementById('loading');
        
        // 语言选择器
        this.sourceLangSelect = document.getElementById('sourceLang');
        this.targetLangSelect = document.getElementById('targetLang');
        this.swapLanguagesBtn = document.getElementById('swapLanguages');
        this.sourceLangLabel = document.getElementById('sourceLangLabel');
        this.targetLangLabel = document.getElementById('targetLangLabel');
        
        // 按钮
        this.settingsBtn = document.getElementById('settingsBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        
        // 模态框
        this.settingsModal = document.getElementById('settingsModal');
        this.closeModal = document.querySelector('.close');
        this.saveSettingsBtn = document.getElementById('saveSettings');
        
        // 设置元素
        this.apiKeyInput = document.getElementById('apiKey');
        this.autoTranslateCheckbox = document.getElementById('autoTranslate');
        this.saveHistoryCheckbox = document.getElementById('saveHistory');
        this.themeSelect = document.getElementById('theme');
        
        // 历史记录
        this.historyList = document.getElementById('historyList');
    }

    bindEvents() {
        // 翻译相关事件
        this.translateBtn.addEventListener('click', () => this.translate());
        this.inputText.addEventListener('input', () => this.handleInput());
        this.inputText.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.translate();
            }
        });

        // 语言选择事件
        this.sourceLangSelect.addEventListener('change', () => this.updateLanguageLabels());
        this.targetLangSelect.addEventListener('change', () => this.updateLanguageLabels());
        this.swapLanguagesBtn.addEventListener('click', () => this.swapLanguages());

        // 按钮事件
        this.clearBtn.addEventListener('click', () => this.clearInput());
        this.copyBtn.addEventListener('click', () => this.copyOutput());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        // 模态框事件
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.closeModal.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        
        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettings();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.settingsModal.style.display === 'block') {
                this.closeSettings();
            }
        });
    }

    handleInput() {
        const text = this.inputText.value;
        this.charCount.textContent = text.length;
        
        // 字符数颜色提示
        if (text.length > 4500) {
            this.charCount.style.color = '#dc3545';
        } else if (text.length > 4000) {
            this.charCount.style.color = '#ffc107';
        } else {
            this.charCount.style.color = '#666';
        }

        // 自动翻译
        if (this.settings.autoTranslate && text.trim()) {
            clearTimeout(this.autoTranslateTimer);
            this.autoTranslateTimer = setTimeout(() => {
                this.translate();
            }, 1500);
        }
    }

    async translate() {
        const inputText = this.inputText.value.trim();
        
        if (!inputText) {
            this.showMessage('请输入要翻译的内容', 'warning');
            return;
        }

        if (!this.apiKey) {
            this.showMessage('请先在设置中配置API密钥', 'warning');
            this.openSettings();
            return;
        }

        if (!this.validateLanguageSelection()) {
            return;
        }

        this.setTranslating(true);

        try {
            const translatedText = await this.callTranslationAPI(inputText);
            this.outputText.value = translatedText;
            
            if (this.settings.saveHistory) {
                const sourceLang = this.languageMap[this.sourceLangSelect.value] || this.sourceLangSelect.value;
                const targetLang = this.languageMap[this.targetLangSelect.value] || this.targetLangSelect.value;
                this.addToHistory(inputText, translatedText, sourceLang, targetLang);
            }
            
            this.showMessage('翻译完成！', 'success');
        } catch (error) {
            console.error('翻译错误:', error);
            this.showMessage('翻译失败: ' + error.message, 'error');
            this.outputText.value = '';
        } finally {
            this.setTranslating(false);
        }
    }

    async callTranslationAPI(text) {
        const sourceLang = this.sourceLangSelect.value;
        const targetLang = this.targetLangSelect.value;
        
        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'qwen-mt-turbo',
                messages: [
                    {
                        role: 'user',
                        content: text
                    }
                ],
                translation_options: {
                    source_lang: sourceLang,
                    target_lang: targetLang
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API返回格式错误');
        }

        return data.choices[0].message.content;
    }

    setTranslating(isTranslating) {
        this.translateBtn.disabled = isTranslating;
        if (isTranslating) {
            this.translateBtn.classList.add('loading');
            this.translateBtn.querySelector('span').textContent = '翻译中...';
        } else {
            this.translateBtn.classList.remove('loading');
            this.translateBtn.querySelector('span').textContent = '翻译';
        }
    }

    clearInput() {
        this.inputText.value = '';
        this.outputText.value = '';
        this.charCount.textContent = '0';
        this.charCount.style.color = '#666';
        this.inputText.focus();
    }

    async copyOutput() {
        const text = this.outputText.value;
        if (!text) {
            this.showMessage('没有可复制的内容', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            this.showMessage('已复制到剪贴板！', 'success');
        } catch (error) {
            // 降级方案
            this.outputText.select();
            document.execCommand('copy');
            this.showMessage('已复制到剪贴板！', 'success');
        }
    }

    addToHistory(source, target, sourceLang = '', targetLang = '') {
        const historyItem = {
            id: Date.now(),
            source: source,
            target: target,
            sourceLang: sourceLang,
            targetLang: targetLang,
            timestamp: new Date().toLocaleString('zh-CN')
        };

        this.history.unshift(historyItem);
        
        // 限制历史记录数量
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }

        localStorage.setItem('translationHistory', JSON.stringify(this.history));
        this.renderHistory();
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<p class="no-history">暂无翻译历史</p>';
            return;
        }

        const historyHTML = this.history.map(item => {
            const langInfo = item.sourceLang && item.targetLang 
                ? `<div class="lang-info">${item.sourceLang} → ${item.targetLang}</div>`
                : '';
            
            return `
                <div class="history-item" data-id="${item.id}">
                    ${langInfo}
                    <div class="source">原文: ${this.escapeHtml(item.source)}</div>
                    <div class="target">译文: ${this.escapeHtml(item.target)}</div>
                    <div class="time">${item.timestamp}</div>
                </div>
            `;
        }).join('');

        this.historyList.innerHTML = historyHTML;

        // 添加点击事件
        this.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                const historyItem = this.history.find(h => h.id === id);
                if (historyItem) {
                    this.inputText.value = historyItem.source;
                    this.outputText.value = historyItem.target;
                    this.handleInput();
                }
            });
        });
    }

    clearHistory() {
        if (confirm('确定要清空所有翻译历史吗？')) {
            this.history = [];
            localStorage.removeItem('translationHistory');
            this.renderHistory();
            this.showMessage('历史记录已清空', 'success');
        }
    }

    openSettings() {
        this.apiKeyInput.value = this.apiKey;
        this.autoTranslateCheckbox.checked = this.settings.autoTranslate;
        this.saveHistoryCheckbox.checked = this.settings.saveHistory;
        this.themeSelect.value = this.settings.theme;
        
        this.settingsModal.style.display = 'block';
        this.apiKeyInput.focus();
    }

    closeSettings() {
        this.settingsModal.style.display = 'none';
    }

    saveSettings() {
        // 保存API密钥
        this.apiKey = this.apiKeyInput.value.trim();
        localStorage.setItem('dashscope_api_key', this.apiKey);

        // 保存其他设置
        this.settings.autoTranslate = this.autoTranslateCheckbox.checked;
        this.settings.saveHistory = this.saveHistoryCheckbox.checked;
        this.settings.theme = this.themeSelect.value;

        localStorage.setItem('autoTranslate', this.settings.autoTranslate);
        localStorage.setItem('saveHistory', this.settings.saveHistory);
        localStorage.setItem('theme', this.settings.theme);

        // 应用主题
        this.applyTheme();

        this.closeSettings();
        this.showMessage('设置已保存！', 'success');
    }

    loadSettings() {
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }

    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `success-message ${type}`;
        messageEl.textContent = message;
        
        // 设置颜色
        const colors = {
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545',
            info: '#17a2b8'
        };
        messageEl.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    updateLanguageLabels() {
        const sourceLang = this.sourceLangSelect.value;
        const targetLang = this.targetLangSelect.value;
        
        this.sourceLangLabel.textContent = this.languageMap[sourceLang] || sourceLang;
        this.targetLangLabel.textContent = this.languageMap[targetLang] || targetLang;
        
        // 更新输入框占位符
        const sourceLangName = this.languageMap[sourceLang] || sourceLang;
        this.inputText.placeholder = `请输入要翻译的${sourceLangName}内容...`;
    }

    swapLanguages() {
        const sourceLang = this.sourceLangSelect.value;
        const targetLang = this.targetLangSelect.value;
        
        // 不能交换自动检测
        if (sourceLang === 'auto') {
            this.showMessage('自动检测语言无法交换', 'warning');
            return;
        }
        
        // 交换语言选择
        this.sourceLangSelect.value = targetLang;
        this.targetLangSelect.value = sourceLang;
        
        // 交换文本内容
        const inputText = this.inputText.value;
        const outputText = this.outputText.value;
        
        this.inputText.value = outputText;
        this.outputText.value = inputText;
        
        // 更新标签和字符计数
        this.updateLanguageLabels();
        this.handleInput();
        
        this.showMessage('语言已交换', 'success');
    }

    validateLanguageSelection() {
        const sourceLang = this.sourceLangSelect.value;
        const targetLang = this.targetLangSelect.value;
        
        if (sourceLang === targetLang && sourceLang !== 'auto') {
            this.showMessage('源语言和目标语言不能相同', 'warning');
            return false;
        }
        
        return true;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new TranslatorApp();
});

// 添加一些实用的快捷键
document.addEventListener('keydown', (e) => {
    // Ctrl+/ 打开设置
    if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        document.getElementById('settingsBtn').click();
    }
    
    // Ctrl+L 清空输入
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        document.getElementById('clearBtn').click();
    }
    
    // Ctrl+Shift+C 复制输出
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        document.getElementById('copyBtn').click();
    }
});
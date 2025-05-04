// VConsole初始化
let vConsole = null;
try {
    if (typeof VConsole !== 'undefined') {
        vConsole = new VConsole({
            defaultPlugins: ['system', 'network', 'element', 'storage'],
            maxLogNumber: 1000,
            onReady: function() {
                console.log('VConsole is ready.');
            }
        });
    }
} catch (error) {
    console.warn('VConsole initialization failed:', error);
}

// 学习分析管理器
class LearningAnalytics {
    constructor() {
        this.STORAGE_KEY = 'learning_analytics';
        this.data = this.loadData();
    }

    // 加载数据
    loadData() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : {
                questions: {},           // 问题频率统计
                topics: {},             // 主题分布
                sessionAnalytics: {},    // 会话分析
                personalRecommendations: {} // 个性化建议
            };
        } catch (error) {
            console.error('加载学习数据失败:', error);
            return {
                questions: {},
                topics: {},
                sessionAnalytics: {},
                personalRecommendations: {}
            };
        }
    }

    // 保存数据
    saveData() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (error) {
            console.error('保存学习数据失败:', error);
        }
    }

    // 记录新问题
    recordQuestion(question, sessionId) {
        try {
            console.log('记录问题:', question, '会话ID:', sessionId);
            
            // 1. 更新问题频率
            const questionKey = this.normalizeQuestion(question);
            this.data.questions[questionKey] = (this.data.questions[questionKey] || 0) + 1;

            // 2. 分析问题主题
            const topics = this.analyzeTopics(question);
            console.log('分析出的主题:', topics);
            
            topics.forEach(topic => {
                this.data.topics[topic] = (this.data.topics[topic] || 0) + 1;
            });

            // 3. 更新会话分析
            if (!this.data.sessionAnalytics[sessionId]) {
                console.log('创建新的会话数据');
                this.data.sessionAnalytics[sessionId] = {
                    questions: [],
                    topics: new Set(),  // 确保使用Set
                    startTime: Date.now(),
                    lastActive: Date.now()
                };
            } else if (!(this.data.sessionAnalytics[sessionId].topics instanceof Set)) {
                console.log('将已有topics转换为Set');
                // 如果topics不是Set，将其转换为Set
                const existingTopics = Array.from(this.data.sessionAnalytics[sessionId].topics || []);
                this.data.sessionAnalytics[sessionId].topics = new Set(existingTopics);
            }
            
            // 添加问题记录
            this.data.sessionAnalytics[sessionId].questions.push({
                question: question,
                timestamp: Date.now(),
                topics: topics
            });
            
            // 更新主题集合
            const sessionTopics = this.data.sessionAnalytics[sessionId].topics;
            topics.forEach(topic => {
                console.log('添加主题到Set:', topic);
                sessionTopics.add(topic);
            });
            
            // 更新最后活动时间
            this.data.sessionAnalytics[sessionId].lastActive = Date.now();

            // 4. 生成个性化建议
            this.generateRecommendations(sessionId);

            // 5. 保存更新
            this.saveData();
            console.log('问题记录完成，当前会话数据:', {
                questions: this.data.sessionAnalytics[sessionId].questions.length,
                topics: Array.from(this.data.sessionAnalytics[sessionId].topics),
                startTime: new Date(this.data.sessionAnalytics[sessionId].startTime).toLocaleString(),
                lastActive: new Date(this.data.sessionAnalytics[sessionId].lastActive).toLocaleString()
            });

        } catch (error) {
            console.error('记录问题时出错:', error);
            // 尝试恢复或初始化数据结构
            if (!this.data.sessionAnalytics[sessionId]) {
                this.data.sessionAnalytics[sessionId] = {
                    questions: [],
                    topics: new Set(),
                    startTime: Date.now(),
                    lastActive: Date.now()
                };
            }
        }
    }

    // 标准化问题文本
    normalizeQuestion(question) {
        return question.toLowerCase().trim();
    }

    // 分析问题主题
    analyzeTopics(question) {
        console.log('开始分析问题主题:', question);
        const topics = new Set();
        const normalizedQuestion = question.toLowerCase();
        
        // 数学相关关键词
        const mathKeywords = /方程|函数|几何|代数|证明|计算|求解|数列|极限|导数|积分|三角|概率|统计|矩阵|向量|集合|不等式|方差|均值|微分|线性|二次|一元|二元|多项式|因式|分解|最大值|最小值|函数图像|数轴|坐标|圆|相似|全等|勾股|椭圆|双曲线|抛物线/g;
        if (mathKeywords.test(normalizedQuestion)) {
            topics.add('数学');
        }
        
        // 物理相关关键词
        const physicsKeywords = /力|速度|加速度|动能|势能|电|磁|热|光|波|功|能量|质量|密度|压强|浮力|摩擦|重力|弹力|电流|电压|电阻|电场|磁场|温度|热量|声波|频率|波长|反射|折射|干涉|衍射|动量|冲量|功率|机械|牛顿|库仑|欧姆|焦耳/g;
        if (physicsKeywords.test(normalizedQuestion)) {
            topics.add('物理');
        }
        
        // 化学相关关键词
        const chemistryKeywords = /元素|化合物|反应|氧化|还原|酸|碱|盐|离子|原子|分子|化学式|方程式|价态|价电子|化合价|周期表|金属|非金属|氧化物|氢氧化物|浓度|溶液|溶解度|催化剂|电解质|氧化还原|中和|燃烧|分解|置换|复分解|沉淀/g;
        if (chemistryKeywords.test(normalizedQuestion)) {
            topics.add('化学');
        }
        
        // 生物相关关键词
        const biologyKeywords = /细胞|基因|遗传|进化|生态|光合|呼吸|酶|蛋白质|DNA|RNA|染色体|减数分裂|有丝分裂|生物膜|线粒体|叶绿体|内质网|高尔基体|溶酶体|核糖体|细胞壁|细胞膜|生态系统|食物链|种群|群落|生物圈|生物多样性|遗传密码|基因表达/g;
        if (biologyKeywords.test(normalizedQuestion)) {
            topics.add('生物');
        }
        
        // 英语相关关键词
        const englishKeywords = /grammar|vocabulary|tense|reading|writing|speaking|listening|pronunciation|word|sentence|paragraph|essay|article|composition|translation|interpretation|dialogue|conversation|present|past|future|perfect|continuous|passive|active|irregular|regular|verb|noun|adjective|adverb|preposition|conjunction|phrase|clause/g;
        if (englishKeywords.test(normalizedQuestion)) {
            topics.add('英语');
        }

        // 如果没有匹配到任何主题，标记为"其他"
        if (topics.size === 0) {
            topics.add('其他');
        }

        console.log('分析结果:', Array.from(topics));
        return Array.from(topics);
    }

    // 生成个性化建议
    generateRecommendations(sessionId) {
        try {
            const sessionData = this.data.sessionAnalytics[sessionId];
            if (!sessionData) return;

            const recommendations = {
                weakTopics: [],      // 需要加强的主题
                suggestedResources: [], // 建议的学习资源
                learningPath: [],    // 学习路径建议
                timeManagement: []   // 时间管理建议
            };

            // 1. 分析薄弱主题
            const topicFrequency = {};
            sessionData.questions.forEach(q => {
                const topics = this.analyzeTopics(q.question);
                topics.forEach(topic => {
                    topicFrequency[topic] = (topicFrequency[topic] || 0) + 1;
                });
            });

            // 找出提问最多的主题作为薄弱项
            const sortedTopics = Object.entries(topicFrequency)
                .sort(([,a], [,b]) => b - a);
            
            if (sortedTopics.length > 0) {
                recommendations.weakTopics.push({
                    topic: sortedTopics[0][0],
                    message: `建议加强 ${sortedTopics[0][0]} 的学习，这是你最常问到的主题。`
                });
            }

            // 2. 根据主题推荐学习资源
            recommendations.suggestedResources = this.getResourceRecommendations(sortedTopics.map(([topic]) => topic));

            // 3. 生成学习路径建议
            recommendations.learningPath = this.generateLearningPath(sortedTopics.map(([topic]) => topic));

            // 4. 时间管理建议
            const questionTimes = sessionData.questions.map(q => q.timestamp);
            if (questionTimes.length >= 2) {
                const timeGaps = [];
                for (let i = 1; i < questionTimes.length; i++) {
                    timeGaps.push(questionTimes[i] - questionTimes[i-1]);
                }
                const avgTimeGap = timeGaps.reduce((a,b) => a + b, 0) / timeGaps.length;
                
                if (avgTimeGap < 5 * 60 * 1000) { // 5分钟
                    recommendations.timeManagement.push(
                        "建议在提问之间留出更多时间进行独立思考和练习。"
                    );
                }
            }

            // 保存建议
            this.data.personalRecommendations[sessionId] = recommendations;
            this.saveData();

        } catch (error) {
            console.error('生成建议时出错:', error);
        }
    }

    // 获取资源推荐
    getResourceRecommendations(topics) {
        const recommendations = [];
        const resourceMap = {
            '数学': [
                '可汗学院的数学课程视频',
                '数学分析习题集',
                '高等数学辅导资料'
            ],
            '物理': [
                '物理实验模拟软件',
                '力学练习题集',
                '物理公式速查手册'
            ],
            '化学': [
                '化学实验安全指南',
                '元素周期表学习工具',
                '化学方程式配平练习'
            ],
            '生物': [
                '细胞结构3D模型',
                '生物学实验报告范例',
                '基因遗传规律练习题'
            ],
            '英语': [
                '英语听力训练材料',
                '语法练习题集',
                '口语练习应用推荐'
            ]
        };

        topics.forEach(topic => {
            if (resourceMap[topic]) {
                recommendations.push({
                    topic: topic,
                    resources: resourceMap[topic]
                });
            }
        });

        return recommendations;
    }

    // 生成学习路径建议
    generateLearningPath(topics) {
        const pathMap = {
            '数学': [
                '1. 复习基础概念和定义',
                '2. 练习基础题型',
                '3. 尝试解决综合题',
                '4. 总结解题方法和技巧'
            ],
            '物理': [
                '1. 理解物理概念',
                '2. 掌握公式推导',
                '3. 练习典型题目',
                '4. 进行实验验证'
            ],
            '化学': [
                '1. 记忆基本概念',
                '2. 理解反应原理',
                '3. 练习方程式书写',
                '4. 进行实验操作'
            ],
            '生物': [
                '1. 学习基础知识',
                '2. 理解生命过程',
                '3. 观察实验现象',
                '4. 总结规律特点'
            ],
            '英语': [
                '1. 扩充词汇量',
                '2. 强化语法基础',
                '3. 提高听说能力',
                '4. 练习阅读写作'
            ]
        };

        const learningPath = [];
        topics.forEach(topic => {
            if (pathMap[topic]) {
                learningPath.push({
                    topic: topic,
                    steps: pathMap[topic]
                });
            }
        });

        return learningPath;
    }

    // 获取学习报告
    getLearningReport(sessionId) {
        console.log('获取学习报告，会话ID:', sessionId);
        try {
            const sessionData = this.data.sessionAnalytics[sessionId];
            console.log('会话数据:', sessionData);
            
            // 如果没有会话数据，创建默认数据
            if (!sessionData) {
                console.log('没有找到会话数据，创建默认报告');
                return {
                    sessionDuration: 0,
                    questionCount: 0,
                    topics: [],
                    recommendations: {
                        weakTopics: [],
                        suggestedResources: [],
                        learningPath: [],
                        timeManagement: ['开始提问以获取学习建议']
                    },
                    lastActive: Date.now()
                };
            }

            // 确保topics是Set对象
            if (!(sessionData.topics instanceof Set)) {
                console.log('转换topics为Set');
                sessionData.topics = new Set(Array.from(sessionData.topics || []));
            }

            // 如果没有推荐数据，生成新的推荐
            if (!this.data.personalRecommendations[sessionId]) {
                console.log('生成新的推荐数据');
                this.generateRecommendations(sessionId);
            }

            const recommendations = this.data.personalRecommendations[sessionId] || {
                weakTopics: [],
                suggestedResources: [],
                learningPath: [],
                timeManagement: []
            };

            console.log('返回报告数据');
            return {
                sessionDuration: Date.now() - sessionData.startTime,
                questionCount: sessionData.questions.length,
                topics: Array.from(sessionData.topics),
                recommendations: recommendations,
                lastActive: sessionData.lastActive
            };
        } catch (error) {
            console.error('获取学习报告时出错:', error);
            return {
                sessionDuration: 0,
                questionCount: 0,
                topics: [],
                recommendations: {
                    weakTopics: [],
                    suggestedResources: [],
                    learningPath: [],
                    timeManagement: ['暂时无法获取学习数据']
                },
                lastActive: Date.now()
            };
        }
    }

    // 显示学习报告
    displayLearningReport(sessionId) {
        console.log('开始生成学习报告，会话ID:', sessionId);
        try {
            const report = this.getLearningReport(sessionId);
            console.log('获取到的报告数据:', report);

            // 创建模态框容器
            const modalDiv = document.createElement('div');
            modalDiv.className = 'report-modal';
            modalDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;

            // 生成报告内容
            const content = document.createElement('div');
            content.className = 'report-modal-content';
            content.style.cssText = `
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 800px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;

            // 添加关闭按钮
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '&times;';
            closeButton.className = 'close-button';
            closeButton.style.cssText = `
                position: absolute;
                right: 10px;
                top: 10px;
                font-size: 24px;
                cursor: pointer;
                background: none;
                border: none;
                color: #666;
            `;

            // 获取提问历史
            const questions = this.data.sessionAnalytics[sessionId]?.questions || [];
            const questionsList = questions.map(q => ({
                question: q.question,
                timestamp: new Date(q.timestamp).toLocaleString(),
                topics: q.topics || []
            }));

            // 生成报告HTML
            const reportContent = document.createElement('div');
            reportContent.className = 'learning-report';
            reportContent.innerHTML = `
                <h3 style="margin-bottom: 20px; color: #333;">学习报告</h3>
                
                <div class="report-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <h4 style="color: #1a73e8; margin-bottom: 15px;">学习概况</h4>
                    <p>学习时长: ${this.formatDuration(report.sessionDuration)}</p>
                    <p>提问数量: ${report.questionCount}题</p>
                </div>

                <div class="report-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <h4 style="color: #1a73e8; margin-bottom: 15px;">提问历史</h4>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${questionsList.map(q => `
                            <div style="margin-bottom: 15px; padding: 10px; background: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <p style="margin: 0; color: #666; font-size: 0.9em;">${q.timestamp}</p>
                                <p style="margin: 5px 0; color: #333;">${q.question}</p>
                                <p style="margin: 0; color: #666; font-size: 0.9em;">主题: ${q.topics.join(', ') || '未分类'}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="report-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <h4 style="color: #1a73e8; margin-bottom: 15px;">需要加强的主题</h4>
                    <div id="improvement-suggestions" style="min-height: 50px;">
                        <p style="color: #666;">正在分析学习数据...</p>
                    </div>
                </div>
            `;

            // 组装模态框
            content.appendChild(closeButton);
            content.appendChild(reportContent);
            modalDiv.appendChild(content);

            // 添加到body
            document.body.appendChild(modalDiv);
            console.log('模态框已添加到DOM');

            // 获取主题建议
            this.fetchImprovementSuggestions(sessionId, questionsList).then(suggestions => {
                const suggestionsDiv = document.getElementById('improvement-suggestions');
                if (suggestionsDiv) {
                    suggestionsDiv.innerHTML = suggestions;
                }
            });

            // 添加关闭事件
            closeButton.onclick = () => {
                console.log('关闭按钮被点击');
                document.body.removeChild(modalDiv);
            };

            // 点击模态框外部关闭
            modalDiv.onclick = (e) => {
                if (e.target === modalDiv) {
                    console.log('点击模态框外部，关闭模态框');
                    document.body.removeChild(modalDiv);
                }
            };

            console.log('学习报告显示完成');
        } catch (error) {
            console.error('显示学习报告时出错:', error);
            showSystemMessage('显示学习报告时出错: ' + error.message, 'error');
        }
    }

    // 获取主题改进建议
    async fetchImprovementSuggestions(sessionId, questionsList) {
        try {
            const response = await fetch('/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: `基于以下学习历史，请分析我需要加强哪些主题，并给出具体的改进建议：\n${
                        questionsList.map(q => `问题：${q.question}\n时间：${q.timestamp}\n主题：${q.topics.join(', ')}\n`).join('\n')
                    }`,
                    sessionId: sessionId
                })
            });

            if (!response.ok) {
                throw new Error('获取建议失败');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let suggestions = '';
            let messageContainer = null;

            while (true) {
                const {value, done} = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;

                    if (line.startsWith('data:')) {
                        try {
                            const data = line.slice(5).trim();
                            
                            // 如果是[DONE]标记，结束处理
                            if (data === '[DONE]') {
                                console.log('收到[DONE]标记，处理完成');
                                continue;
                            }
                            
                            // 尝试解析JSON数据
                            const jsonData = JSON.parse(data);
                            
                            if (jsonData && jsonData.content !== undefined) {
                                suggestions += jsonData.content;
                                
                                // 使用marked处理Markdown格式
                                const suggestionsDiv = document.getElementById('improvement-suggestions');
                                if (suggestionsDiv) {
                                    try {
                                        // 保护数学公式
                                        const mathExpressions = [];
                                        let mathIndex = 0;

                                        // 临时替换数学公式
                                        const contentWithPlaceholders = suggestions.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
                                            mathExpressions.push(match);
                                            return `%%MATH_EXPR_${mathIndex++}%%`;
                                        });

                                        // 使用marked渲染Markdown
                                        let htmlContent = marked.parse(contentWithPlaceholders);

                                        // 恢复数学公式
                                        htmlContent = htmlContent.replace(/%%MATH_EXPR_(\d+)%%/g, (_, index) => mathExpressions[index]);

                                        suggestionsDiv.innerHTML = htmlContent;

                                        // 触发MathJax重新渲染
                                        if (window.MathJax && window.MathJax.typesetPromise) {
                                            window.MathJax.typesetPromise([suggestionsDiv]).catch((err) => {
                                                console.error('MathJax渲染错误:', err);
                                            });
                                        }
                                    } catch (renderError) {
                                        console.error('渲染建议内容时出错:', renderError);
                                        suggestionsDiv.innerHTML = suggestions; // 降级为纯文本显示
                                    }
                                }
                            }
                        } catch (jsonError) {
                            console.warn('解析JSON数据时出错，尝试继续处理:', jsonError);
                            continue;
                        }
                    }
                }
            }

            return suggestions || '暂无具体改进建议';
        } catch (error) {
            console.error('获取改进建议时出错:', error);
            return '获取改进建议时出错，请稍后再试';
        }
    }

    // 格式化持续时间
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟`;
        } else {
            return `${seconds}秒`;
        }
    }
}

// 导出学习分析器实例
window.learningAnalytics = new LearningAnalytics();

document.addEventListener('DOMContentLoaded', () => {
    // 获取必要的DOM元素
    const elements = {
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        chatMessages: document.getElementById('chat-messages'),
        chatForm: document.getElementById('chat-form'),
        sidebar: document.querySelector('.sidebar'),
        sidebarToggle: document.querySelector('.sidebar-toggle'),
        sidebarBackdrop: document.querySelector('.sidebar-backdrop'),
        statusBar: document.querySelector('.status-bar'),
        addButton: document.getElementById('add-button'),
        uploadMenu: document.getElementById('upload-menu'),
        uploadFileOption: document.getElementById('upload-file-option'),
        fileUpload: document.getElementById('file-upload'),
        showReportButton: document.getElementById('show-report')  // 添加学习报告按钮
    };

    // 用于存储聊天历史的键
    const CHAT_HISTORY_KEY = 'deepseek_chat_history';

    // 获取当前URL中的会话ID - 使用let而不是const，使其可以修改
    let sessionId = getSessionIdFromUrl() || generateSessionId();
    
    // 设置初始历史状态
    if (sessionId && !window.history.state) {
        const currentUrl = window.location.href;
        window.history.replaceState({ sessionId: sessionId }, '', currentUrl);
    }
    
    // 加载历史对话列表
    loadChatHistoryList();
    
    // 将会话ID添加到侧边栏历史记录（如果不在历史记录中）
    if (sessionId) {
        addChatToHistory('新对话', sessionId);
    }

    // 获取URL中的会话ID
    function getSessionIdFromUrl() {
        const path = window.location.pathname;
        const matches = path.match(/\/chat\/s\/([\w-]+)/);
        return matches ? matches[1] : null;
    }

    // 加载历史对话列表
    function loadChatHistoryList() {
        try {
            // 从localStorage获取历史对话列表
            const historyJSON = localStorage.getItem(CHAT_HISTORY_KEY);
            if (historyJSON) {
                const history = JSON.parse(historyJSON);
                
                // 清空现有列表
                const historyList = document.querySelector('.history-nav ul');
                if (historyList) {
                    historyList.innerHTML = '';
                }
                
                // 检查当前会话是否在历史记录中
                let sessionFound = false;
                
                // 遍历历史记录并添加到侧边栏
                if (history.length > 0) {
                    history.forEach(chat => {
                        // 检查是否为当前会话
                        const isActive = chat.id === sessionId;
                        if (isActive) {
                            sessionFound = true;
                        }
                        addChatToHistory(chat.title || '新对话', chat.id, isActive, false); // 最后一个参数false表示不保存到localStorage
                    });
                    
                    console.log('已从本地存储加载', history.length, '个历史对话');
                }
                
                // 如果当前会话不在历史记录中，添加它
                if (!sessionFound && sessionId) {
                    addChatToHistory('新对话', sessionId, true, true);
                }
            } else {
                // 如果没有历史记录，添加当前会话
                if (sessionId) {
                    addChatToHistory('新对话', sessionId, true, true);
                }
            }
        } catch (error) {
            console.error('加载历史对话失败:', error);
            // 出错时，至少添加当前会话
            if (sessionId) {
                addChatToHistory('新对话', sessionId, true, true);
            }
        }
    }

    // 保存历史对话列表到localStorage
    function saveChatHistoryList() {
        try {
            // 获取所有对话链接
            const chatLinks = document.querySelectorAll('.chat-link');
            const history = [];
            
            // 遍历链接并构建历史记录数组
            chatLinks.forEach(link => {
                const id = link.getAttribute('data-chat-id');
                // 提取链接文本（排除删除按钮的文本）
                const titleEl = link.cloneNode(true);
                const deleteBtn = titleEl.querySelector('.delete-chat-btn');
                if (deleteBtn) {
                    deleteBtn.remove();
                }
                const title = titleEl.textContent.trim();
                
                history.push({
                    id: id,
                    title: title || '新对话'
                });
            });
            
            // 保存到localStorage
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
            console.log('已保存', history.length, '个对话到本地存储');
        } catch (error) {
            console.error('保存历史对话失败:', error);
        }
    }

    // 添加对话到历史列表
    function addChatToHistory(chatName, sessionId, isActive = true, shouldSave = true) {
        const historyList = document.querySelector('.history-nav ul');
        if (!historyList) return;
        
        console.log('添加会话到历史记录:', chatName, sessionId); // 调试输出
        
        // 检查是否已存在此会话ID的对话
        const existingChat = document.querySelector(`.chat-link[data-chat-id="${sessionId}"]`);
        if (existingChat) {
            // 如果已存在，只更新active状态
            if (isActive) {
                document.querySelectorAll('.chat-link').forEach(link => {
                    link.classList.remove('active');
                });
                existingChat.classList.add('active');
            }
            return;
        }

        const chatItem = document.createElement('li');
        chatItem.className = 'chat-item';

        const chatLink = document.createElement('a');
        chatLink.href = `/chat/s/${sessionId}`;
        chatLink.className = 'chat-link';
        if (isActive) chatLink.classList.add('active');
        chatLink.setAttribute('data-chat-id', sessionId); // 确保设置data-chat-id属性
        chatLink.textContent = chatName;

        // 添加会话管理按钮
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-chat-btn';
        deleteButton.innerHTML = '&times;';
        deleteButton.title = '删除此对话';
        deleteButton.setAttribute('aria-label', '删除对话');
        deleteButton.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            deleteChatHistory(sessionId, chatItem);
            return false; // 阻止事件冒泡
        };

        chatLink.appendChild(deleteButton);
        chatItem.appendChild(chatLink);
        
        // 将新会话添加到列表顶部
        if (historyList.firstChild) {
            historyList.insertBefore(chatItem, historyList.firstChild);
        } else {
            historyList.appendChild(chatItem);
        }
        
        // 保存到localStorage
        if (shouldSave) {
            saveChatHistoryList();
        }
    }

    // 删除会话历史
    async function deleteChatHistory(chatId, chatItem) {
        const confirmDelete = window.confirm('确定要删除这个对话吗？');
        if (!confirmDelete) return;
        
        try {
            // 从DOM中移除
            chatItem.remove();
            
            // 如果删除的是当前会话，检查是否有其他会话可以切换到
            if (chatId === sessionId) {
                // 获取所有剩余的对话链接
                const remainingChats = document.querySelectorAll('.chat-link');
                
                if (remainingChats.length > 0) {
                    // 如果还有其他对话，切换到第一个
                    const firstChatId = remainingChats[0].getAttribute('data-chat-id');
                    loadHistoryChat(firstChatId);
                    showSystemMessage('已切换到其他对话', 'info');
                } else {
                    // 如果没有其他对话，创建一个新的
                    startNewChat();
                }
            }
            
            // 更新localStorage
            saveChatHistoryList();
            
            // 显示成功消息
            showSystemMessage('已删除对话', 'success');
        } catch (error) {
            console.error('删除对话时出错:', error);
            alert('删除对话失败，请刷新页面重试。');
        }
    }

    // 更新会话标题
    function updateChatTitle(title) {
        // 查找当前活动的会话链接
        const activeChat = document.querySelector('.chat-link.active');
        if (activeChat) {
            // 保存原始内容以防包含删除按钮
            const deleteBtn = activeChat.querySelector('.delete-chat-btn');
            
            // 更新文本内容
            activeChat.textContent = title;
            
            // 如果有删除按钮，重新添加
            if (deleteBtn) {
                activeChat.appendChild(deleteBtn);
            }
            
            // 保存更新后的历史记录
            saveChatHistoryList();
        }
    }

    // 全局点击事件处理
    function handleGlobalClick(event) {
        const target = event.target;

        // 处理新对话按钮点击
        if (target.closest('#new-chat-button')) {
            startNewChat();
        }

        // 处理历史对话点击
        if (target.closest('.list-unstyled a')) {
            const chatLink = target.closest('.list-unstyled a');
            // 确保使用data-chat-id属性获取聊天ID
            const chatId = chatLink.dataset.chatId || chatLink.getAttribute('data-chat-id');
            if (chatId) {
                loadHistoryChat(chatId);
            }
        }

        // 处理侧边栏切换
        if (target.closest('.sidebar-toggle') || target.closest('.sidebar-backdrop')) {
            toggleSidebar();
        }
    }

    // 使用事件委托处理所有点击事件
    document.addEventListener('click', handleGlobalClick);
    
    // 初始化
    initializeChat();

    // 初始化聊天功能
	async function initializeChat() {
		// 初始禁用输入框和发送按钮
		setInputState(false);
        elements.sendButton.disabled = true; // 确保页面加载时发送按钮是禁用的
		showSystemMessage('正在加载必要组件...', 'info');

		try {
			// 检测是否为移动设备
			const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
			if (isMobile) {
				console.log('检测到移动设备');
				initMobileDebug();
			}
			
			// 加载外部资源
			await loadExternalResources();

        // 自动聚焦输入框
        focusInput();

        // 设置输入框事件监听
        elements.messageInput.addEventListener('input', handleInput);
        
        // 添加键盘事件监听，处理回车发送消息
        elements.messageInput.addEventListener('keydown', handleKeyPress);

        // 设置表单提交事件
        elements.chatForm.addEventListener('submit', handleSubmit);

        // 设置消息观察器
        setupMessageObserver();
        
        // 监听历史状态变化
        window.addEventListener('popstate', handleHistoryChange);

        // 初始化 Socket.IO
        initializeSocketIO();

        // 调试元素初始化状态
        console.log('初始化前检查上传菜单相关元素:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);
        
        // 重新获取元素（确保在DOM完全加载后）
        elements.addButton = document.getElementById('add-button');
        elements.uploadMenu = document.getElementById('upload-menu');
        elements.uploadFileOption = document.getElementById('upload-file-option');
        elements.fileUpload = document.getElementById('file-upload');
        
        console.log('重新获取后的元素:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);

        // 设置上传菜单事件
        setupUploadMenu();
        
        // 设置作业上传事件监听
        const uploadHomeworkOption = document.querySelector('.upload-option[data-type="homework"]');
        if (uploadHomeworkOption) {
            console.log('找到作业上传选项元素');
            const homeworkInput = document.createElement('input');
            homeworkInput.type = 'file';
            homeworkInput.multiple = true;
            homeworkInput.accept = 'image/*';
            homeworkInput.style.display = 'none';
            document.body.appendChild(homeworkInput);
            
            uploadHomeworkOption.addEventListener('click', () => {
                console.log('作业上传选项被点击');
                hideUploadMenu();
                homeworkInput.click();
            });
            
            homeworkInput.addEventListener('change', (e) => {
                console.log('选择了作业文件:', e.target.files);
                handleHomeworkUpload(e.target.files);
                homeworkInput.value = ''; // 清空选择，允许重复选择相同文件
            });
        } else {
            console.warn('未找到作业上传选项元素');
        }

			// 所有初始化完成后启用输入框，但保持发送按钮禁用状态（直到有输入）
			setInputState(true);
            elements.sendButton.disabled = true; // 初始状态下输入框是空的，所以发送按钮应该是禁用的
			showSystemMessage('准备就绪', 'success');
		} catch (error) {
			console.error('初始化失败:', error);
			showSystemMessage('初始化失败，请刷新页面重试', 'error');
		}
    }

    // 聚焦输入框
    function focusInput() {
        // 只在页面加载和发送消息后聚焦
        if (!elements.messageInput.disabled && !isUserSelecting()) {
            elements.messageInput.focus();
        }
    }

    // 检查用户是否正在选择文本
    function isUserSelecting() {
        const selection = window.getSelection();
        return selection && selection.toString().length > 0;
    }

    // 处理输入框事件
    function handleInput(event) {
        const input = event.target;
        
        // 自动调整高度
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
        
        // 更新发送按钮状态 - 确保消息为空时发送按钮处于禁用状态
        const isEmpty = !input.value.trim();
        elements.sendButton.disabled = isEmpty;
    }

    // 处理键盘事件
    function handleKeyPress(event) {
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // 如果是移动设备，按下Enter键时插入换行
        if (isMobile) {
            if (event.key === 'Enter') {
                // 阻止默认行为（提交表单和自动插入换行）
            event.preventDefault();
                
                // 在移动设备上，默认Enter键插入换行
                insertNewline(event.target);
                return;
            }
            return; // 其他按键正常处理
        }
        
        // 桌面端处理：按下Enter键且没有按下Shift键和Alt键，则发送消息
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
            event.preventDefault(); // 阻止默认行为
            
            // 检查消息是否为空
            const isEmpty = !event.target.value.trim();
            if (!isEmpty) {
                handleSubmit(event); // 如果消息不为空，则发送
            } else {
                // 如果消息为空，可以添加振动反馈（如果支持）
                if (navigator.vibrate) {
                    navigator.vibrate(100); // 轻微振动提示
                }
            }
        }
        // 如果按下Enter键且按下Shift键或Alt键，则插入换行
        else if (event.key === 'Enter' && (event.shiftKey || event.altKey)) {
            event.preventDefault();
            insertNewline(event.target);
        }
    }
    
    // 插入换行的辅助函数
    function insertNewline(input) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const value = input.value;
            const beforeCursor = value.substring(0, start);
            const afterCursor = value.substring(end);
            
        // 插入单个换行符，而不是两个
        input.value = beforeCursor + '\n' + afterCursor;
            
            // 将光标移动到新的位置
        input.selectionStart = input.selectionEnd = start + 1;
            
            // 触发input事件以调整文本框高度
            input.dispatchEvent(new Event('input'));
    }

    // 处理消息的显示
	function updateMessageDisplay(messageElement, content) {
		try {
			// 检查marked是否可用
			if (typeof window.marked === 'undefined') {
				console.warn('marked库未加载，使用基本渲染');
				// 基本渲染：保留HTML标签和数学公式
				const basicRenderedContent = content
					.replace(/\n/g, '<br>')  // 换行转换为<br>
					.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // 粗体
					.replace(/\*(.*?)\*/g, '<em>$1</em>')  // 斜体
					.replace(/`([^`]+)`/g, '<code>$1</code>')  // 行内代码
					.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')  // 代码块
					.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')  // 链接
					.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')  // 无序列表
					.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')  // 有序列表
					.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')  // 包装列表
					.replace(/^\s*>\s*(.+)$/gm, '<blockquote>$1</blockquote>')  // 引用
					.replace(/^\s*#{1,6}\s+(.+)$/gm, (match, text) => {
						const level = match.match(/^#+/)[0].length;
						return `<h${level}>${text}</h${level}>`;
					});  // 标题

				updateMessageContent(messageElement, basicRenderedContent);
			} else {
				// 使用marked渲染Markdown，但保护数学公式
				const mathExpressions = [];
				let mathIndex = 0;

				// 临时替换数学公式
				const contentWithPlaceholders = content.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
					mathExpressions.push(match);
					return `%%MATH_EXPR_${mathIndex++}%%`;
				});

				// 渲染Markdown
				let htmlContent = window.marked.parse(contentWithPlaceholders);

				// 恢复数学公式
				htmlContent = htmlContent.replace(/%%MATH_EXPR_(\d+)%%/g, (_, index) => mathExpressions[index]);

				updateMessageContent(messageElement, htmlContent);

				// 触发MathJax重新渲染
				if (window.MathJax && window.MathJax.typesetPromise) {
					window.MathJax.typesetPromise([messageElement]).catch((err) => {
						console.error('MathJax渲染错误:', err);
                    });
                }
            }
            
            // 滚动到底部
            scrollToBottom();
        } catch (error) {
            console.error('更新消息显示时出错:', error);
			// 发生错误时使用纯文本显示
			updateMessageContent(messageElement, escapeHtml(content));
		}
	}

	function preprocessTableContent(content) {
		const lines = content.split('\n');
		const result = [];
		let isInTable = false;
		let tableLines = [];

		for (let line of lines) {
			if (line.includes('|')) {
				if (!isInTable) {
					isInTable = true;
				}
				tableLines.push(line);
			} else {
				if (isInTable) {
					if (tableLines.length >= 2) {
						// 处理表格
						result.push('');  // 空行
						result.push(...formatTableLines(tableLines));
						result.push('');  // 空行
					} else {
						// 不是有效的表格，作为普通文本处理
						result.push(...tableLines);
					}
					isInTable = false;
					tableLines = [];
				}
				result.push(line);
			}
		}

		// 处理最后的表格（如果有）
		if (isInTable && tableLines.length >= 2) {
			result.push('');
			result.push(...formatTableLines(tableLines));
			result.push('');
		}

		return result.join('\n');
	}

	function formatTableLines(lines) {
		// 确保至少有标题行
		if (lines.length === 0) return [];

		// 处理每一行，标准化格式
		const formattedLines = lines.map(line => {
			// 移除首尾的|，并分割单元格
			const cells = line.trim().replace(/^\||\|$/g, '').split('|');

			// 处理每个单元格
			const formattedCells = cells.map(cell => cell.trim() || '-');

			// 重新组合行
			return `| ${formattedCells.join(' | ')} |`;
		});

		// 如果没有分隔行，在第一行后添加
		if (lines.length === 1 || !lines[1].includes('-')) {
			const headerCells = formattedLines[0].split('|').length - 2;
			const separator = `|${' --- |'.repeat(headerCells)}`;
			formattedLines.splice(1, 0, separator);
		}

		return formattedLines;
    }

    // 检查文本是否看起来像代码
    function looksLikeCode(text) {
        // 检查是否包含常见的代码特征
        const codeIndicators = [
            /^[\s]*[{}\[\]]/,           // 以括号开始
            /[;{}()\[\]]{3,}/,          // 包含多个括号或分号
            /\b(function|class|if|for|while|return|var|let|const)\b/, // 常见关键字
            /^[\s]*[a-zA-Z]+[\w\s]*\([^\)]*\)[\s]*{/,  // 函数定义
            /^[\s]*import\s+|^[\s]*export\s+/,          // import/export 语句
            /[\s]*[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/,    // 变量赋值
            /^[\s]*<[a-zA-Z]/,          // HTML标签
            /^[\s]*#include|^[\s]*#define/  // C/C++预处理指令
        ];

        return codeIndicators.some(pattern => pattern.test(text));
    }

    // 添加表格缓冲处理
	let tableBuffer = '';
	let isCollectingTable = false;
	let tableStartIndex = -1;
    
    // 发送消息并获取流式响应（POST方式）
	async function askQuestionStreamPost(question, retryCount = 3) {
        try {
            // 参数验证
            if (!question || typeof question !== 'string') {
                throw new Error('无效的问题格式');
            }

            // 只在第一次尝试时显示用户消息，避免重复显示
            if (retryCount === 3) {
            addMessage(question, 'user');
            }
            
            // 禁用输入，表示正在处理
            setInputState(false);
            showSystemMessage(retryCount === 3 ? '正在思考...' : `正在重试(${3-retryCount}/3)...`, retryCount === 3 ? 'info' : 'warning');
            
            // 发送请求
            const response = await fetch('/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    question: question,
                    sessionId: sessionId || ''  // 确保sessionId不为undefined
                })
            });

            // 处理HTTP错误
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 获取响应的文本流
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let messageContainer = null;
            let currentMessage = '';
            let buffer = '';

            // 读取流
            while (true) {
                const {value, done} = await reader.read();
                
                if (done) {
                    console.log('流读取完成');
                    break;
                }

                // 解码新的数据块
                const chunk = decoder.decode(value, {stream: true});
                if (!chunk) continue;  // 跳过空块
                
                buffer += chunk;

                try {
                    // 按行分割并处理每一行
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line || !line.trim()) continue;  // 跳过空行

                        // 处理data行
                        if (line.startsWith('data:')) {
                            const data = line.slice(5).trim();
                    
                    // 如果是[DONE]标记，结束处理
                            if (data === '[DONE]') {
                        console.log('收到[DONE]标记，处理完成');
                        continue;
                    }
                    
                            // 尝试解析JSON数据
                            try {
                                const jsonData = JSON.parse(data);
                                
                                // 创建消息容器（如果还没有）
                            if (!messageContainer) {
                                    messageContainer = createMessageElement('assistant', '');
                                    if (elements.chatMessages) {
                                        elements.chatMessages.appendChild(messageContainer);
                                    }
                                }

                                // 更新消息内容
                                if (jsonData && jsonData.content !== undefined) {
                                    currentMessage += jsonData.content;
                                    if (messageContainer) {
                                        updateMessageDisplay(messageContainer, currentMessage);
                                    }
                                }
                            } catch (jsonError) {
                                console.warn('JSON解析失败:', jsonError);
                    }
                }
            }
        } catch (error) {
                    console.error('处理消息时出错:', error);
                }
            }

            setInputState(true);
            showSystemMessage('处理完成', 'success');

        } catch (error) {
            console.error('请求出错:', error);
            showSystemMessage(error.message, 'error');

            if (retryCount > 0) {
                console.log(`还剩 ${retryCount} 次重试机会`);
                // 等待一段时间再重试，时间随重试次数增加
                const delay = (3 - retryCount + 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return askQuestionStreamPost(question, retryCount - 1);
            }

            setInputState(true);
            showSystemMessage('重试次数已用完，请重新发送消息', 'error');
        }
    }

    // 处理表单提交
    async function handleSubmit(event) {
        event.preventDefault();
        const question = elements.messageInput.value.trim();
        
        if (!question) return;
        
        try {
            // 记录问题到学习分析系统
            if (window.learningAnalytics) {
                window.learningAnalytics.recordQuestion(question, sessionId);
            }
            
            // 原有的提交逻辑
            setInputState(false);
            elements.messageInput.value = '';
            adjustTextareaHeight(elements.messageInput);
            
                await askQuestionStreamPost(question);
            } catch (error) {
            console.error('提交问题时出错:', error);
            showErrorMessage(error);
        } finally {
                setInputState(true);
            focusInput();
        }
    }

    // 处理输入框自动调整高度
    function adjustTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }

    // 监听输入框内容变化
    elements.messageInput.addEventListener('input', function() {
        adjustTextareaHeight(this);
    });

    // 设置输入状态
    function setInputState(enabled) {
        elements.messageInput.disabled = !enabled;
        // 根据输入框状态和内容设置发送按钮状态
        if (enabled) {
            // 只有当输入框有内容时才启用发送按钮
            const isEmpty = !elements.messageInput.value.trim();
            elements.sendButton.disabled = isEmpty;
        } else {
            // 禁用状态时，发送按钮也禁用
            elements.sendButton.disabled = true;
        }
        
        if (enabled) {
            elements.messageInput.value = '';
            elements.messageInput.style.height = 'auto';
            // 只在发送消息后聚焦
            focusInput();
        }
    }

    // 处理流式响应
    async function handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let messageDiv = null;
        let responseText = '';

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

				// 处理表格数据
				if (chunk.includes('|')) {
					if (!isCollectingTable) {
						// 开始收集表格数据
						isCollectingTable = true;
						tableStartIndex = responseText.length;
						tableBuffer = '';
					}
					tableBuffer += chunk;

					// 检查表格是否完整
					if (isTableComplete(tableBuffer)) {
						// 表格数据收集完成，进行渲染
						const processedTable = processTableData(tableBuffer);
						responseText = responseText.substring(0, tableStartIndex) + processedTable;
						isCollectingTable = false;
						tableBuffer = '';
					}
				} else {
					// 非表格数据直接添加
					if (isCollectingTable) {
						tableBuffer += chunk;
					} else {
                responseText += chunk;
					}
				}

                // 创建或更新消息
                if (!messageDiv) {
                    messageDiv = createMessageElement('DeepSeek', responseText);
                    elements.chatMessages.appendChild(messageDiv);
        } else {
                    updateMessageContent(messageDiv, responseText);
                }
            }
        } catch (error) {
            console.error('读取响应流失败:', error);
            if (messageDiv) {
                updateMessageContent(messageDiv, '读取响应时发生错误，请重试。', true);
            }
        }
    }

    // 创建消息元素
    function createMessageElement(sender, content, isUser = false) {
        const div = document.createElement('div');
        div.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
		div.innerHTML = `            <div class="message-sender">${sender}</div>
            <div class="message-content">${content}</div>
        `;
        return div;
    }

    // 添加消息到聊天区域
    function addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        // 添加发送者标识
        const senderDiv = document.createElement('div');
        senderDiv.className = 'message-sender';
        senderDiv.textContent = type === 'user' ? '用户' : 'DeepSeek';
        messageDiv.appendChild(senderDiv);
        
        // 添加消息内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        messageDiv.appendChild(contentDiv);
        
		// 用户消息使用 pre 标签保留格式，AI消息使用 Markdown 渲染
		if (type === 'user') {
			contentDiv.style.whiteSpace = 'pre-wrap';  // 保留空格和换行
			contentDiv.style.wordBreak = 'break-word'; // 确保长文本会自动换行

			// 处理数学公式
			const mathExpressions = [];
			let mathIndex = 0;

			// 临时替换数学公式
			const contentWithPlaceholders = content.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
				mathExpressions.push(match);
				return `%%MATH_EXPR_${mathIndex++}%%`;
			});

			// 转义HTML特殊字符，但保留数学公式占位符
			let processedContent = contentWithPlaceholders
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

			// 恢复数学公式
			const finalContent = processedContent.replace(/%%MATH_EXPR_(\d+)%%/g, (_, index) => mathExpressions[index]);

			contentDiv.innerHTML = finalContent;

			// 触发MathJax渲染
			if (window.MathJax && window.MathJax.typesetPromise) {
				window.MathJax.typesetPromise([contentDiv]).catch((err) => {
					console.error('MathJax渲染错误:', err);
				});
			}
		} else {
			// AI消息：使用Markdown渲染
            // 检测是否为移动设备
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                // 添加一个空的div来确保移动端显示完整
                const spacerDiv = document.createElement('div');
                spacerDiv.style.height = '100px';  // 设置足够的高度
                spacerDiv.style.width = '100%';
                spacerDiv.style.clear = 'both';
                messageDiv.appendChild(spacerDiv);
            }
        updateMessageDisplay(messageDiv, content);
		}
        
        elements.chatMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    // 添加消息到聊天区域（简单版本）
    function appendMessage(content) {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message';
        
        // 创建一个临时元素来解码HTML实体
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&#47;/g, "/");
        
        // 获取解码后的文本
        messageContainer.innerHTML = tempDiv.innerHTML;
        
        elements.chatMessages.appendChild(messageContainer);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    function decodeHtmlEntities(text) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        return tempDiv.textContent;
    }

    // 更新消息内容
    function updateMessageContent(messageDiv, content, isError = false) {
        const contentDiv = messageDiv.querySelector('.message-content');
        contentDiv.innerHTML = isError ? escapeHtml(content) : content;
        if (isError) {
            messageDiv.classList.add('error-message');
        }
    }

    // 设置消息观察器
    function setupMessageObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldScroll = false;
            
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    shouldScroll = true;
                }
            });

            if (shouldScroll) {
                // 使用 requestAnimationFrame 确保在DOM更新后滚动
                requestAnimationFrame(() => {
                    scrollToBottom(true);
                });
            }
        });

        observer.observe(elements.chatMessages, { 
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // 滚动到底部
    function scrollToBottom(smooth = true) {
        const chatMessages = elements.chatMessages;
        const lastMessage = chatMessages.lastElementChild;
        
        if (lastMessage) {
            const containerHeight = chatMessages.clientHeight;
            const scrollTop = chatMessages.scrollTop;
            const scrollHeight = chatMessages.scrollHeight;
            const messageHeight = lastMessage.offsetHeight;
            const isNearBottom = (scrollHeight - scrollTop - containerHeight) < messageHeight * 2;

            // 只有当用户已经在接近底部时才自动滚动
            if (isNearBottom) {
                chatMessages.scrollTo({
                    top: scrollHeight,
                    behavior: smooth ? 'smooth' : 'auto'
                });
            }
        }
    }

	// HTML 转义函数（用于所有需要转义的内容）
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;")
			.replace(/`/g, "&#96;"); // 转义反引号
    }

    // 显示系统消息
    function showSystemMessage(message, type = 'info') {
        elements.statusBar.innerHTML = `
            <div class="status-indicator status-${type}">
                ${message}
            </div>
        `;
    }

    // 切换侧边栏
    function toggleSidebar() {
        elements.sidebar.classList.toggle('show');
        elements.sidebarBackdrop.classList.toggle('show');
        document.body.style.overflow = elements.sidebar.classList.contains('show') ? 'hidden' : '';
    }

    // 处理历史状态变化
    function handleHistoryChange(event) {
        if (event.state && event.state.sessionId) {
            console.log('历史状态变化，新会话ID:', event.state.sessionId);
            // 更新当前会话ID
            sessionId = event.state.sessionId;
            
            // 检查此会话是否已在侧边栏中
            const existingChat = document.querySelector(`.chat-link[data-chat-id="${sessionId}"]`);
            if (!existingChat) {
                // 如果不存在，添加到侧边栏
                addChatToHistory('恢复的对话', sessionId);
            } else {
                // 高亮显示当前对话在侧边栏中的项
                updateActiveChat(sessionId);
            }
            
            // 清空消息显示区域，准备加载新会话
            elements.chatMessages.innerHTML = '';
            
            // 这里可以添加加载新会话消息的逻辑
            showSystemMessage('已切换到另一个对话', 'info');
        }
    }

    // 更新活动对话项
    function updateActiveChat(chatId) {
        // 移除所有活动状态
        document.querySelectorAll('.chat-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // 设置新的活动项
        const activeChat = document.querySelector(`.chat-link[data-chat-id="${chatId}"]`);
        if (activeChat) {
            activeChat.classList.add('active');
        }
    }

    // 开始新对话
    function startNewChat() {
        // 添加确认提示，防止意外清空对话
        if (elements.chatMessages.children.length > 0) {
            const confirmNewChat = window.confirm('开始新对话将清空当前对话内容，确定继续吗？');
            if (!confirmNewChat) {
                return; // 用户取消，不清空对话
            }
        }
        
        // 生成新的会话ID
        const newSessionId = generateSessionId();
        
        // 先在侧边栏添加新对话
        addChatToHistory('新对话', newSessionId);
        
        // 更新当前会话ID
        sessionId = newSessionId;
        
        // 清空消息显示区域
        elements.chatMessages.innerHTML = '';
        
        // 更新URL而不刷新页面
        const newUrl = `/chat/s/${newSessionId}`;
        window.history.pushState({ sessionId: newSessionId }, '', newUrl);
        
        // 显示欢迎消息
        showSystemMessage('已创建新对话', 'success');
        setTimeout(() => {
            focusInput(); // 聚焦到输入框
        }, 100);
    }

    // 加载历史对话
    function loadHistoryChat(chatId) {
        // 如果点击的是当前活动对话，不做任何操作
        if (chatId === sessionId) {
            return;
        }
        
        // 添加确认提示，防止意外丢失当前对话
        if (elements.chatMessages.children.length > 0) {
            const confirmLoad = window.confirm('切换到其他对话将离开当前对话，确定继续吗？');
            if (!confirmLoad) {
                return; // 用户取消，不切换对话
            }
        }
        
        // 更新当前会话ID
        sessionId = chatId;
        
        // 高亮显示当前对话
        updateActiveChat(chatId);
        
        // 清空消息显示区域，准备加载新会话
        elements.chatMessages.innerHTML = '';
        
        // 更新URL而不刷新页面
        const newUrl = `/chat/s/${chatId}`;
        window.history.pushState({ sessionId: chatId }, '', newUrl);
        
        // 这里可以添加加载新会话消息的逻辑
        showSystemMessage('已切换对话', 'info');
    }

    // 初始化 Socket.IO 连接
    function initializeSocketIO() {
        // 检查 Socket.IO 是否加载
        if (typeof io === 'undefined') {
            console.error('Socket.IO 未能加载，将尝试继续使用其他方式通信');
            showSystemMessage('Socket.IO 未能正确加载，但您仍然可以使用基本功能', 'warning');
            return;
        }

        try {
            // 获取当前主机和协议
            const protocol = window.location.protocol;
        const currentHost = window.location.hostname;
            const socketPort = '8081';
            const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
            
            console.log(`尝试连接Socket.IO服务器: ${currentHost}:${socketPort}, 协议: ${wsProtocol}`);
            
            const socket = io(`${protocol}//${currentHost}:${socketPort}`, {
                transports: ['websocket'],
                upgrade: false,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 20000,
                forceNew: true,
                path: '/socket.io/',
                withCredentials: true,
                secure: protocol === 'https:',
                rejectUnauthorized: false,
                extraHeaders: {
                    'Origin': window.location.origin
                }
            });

            // 添加连接事件监听
            socket.on('connect_error', (error) => {
                console.error('连接错误:', error);
                if (error.message.includes('xhr poll error')) {
                    socket.io.opts.transports = ['websocket'];
                }
                showSystemMessage(`无法连接到实时通讯服务器: ${error.message}`, 'warning');
            });

            socket.io.on('error', (error) => {
                console.error('传输错误:', error);
                showSystemMessage(`网络连接不稳定: ${error.message}`, 'warning');
            });

            socket.io.on('reconnect_attempt', (attempt) => {
                console.log(`第 ${attempt} 次重连尝试`);
                showSystemMessage(`正在尝试重新连接(${attempt}/5)...`, 'warning');
            });

            socket.io.on('reconnect_failed', () => {
                console.error('重连失败');
                showSystemMessage('无法连接到服务器，但您仍然可以使用基本功能', 'warning');
            });

            socket.on('connect', () => {
                console.log('Connected to Socket.IO server');
                showSystemMessage('已连接到实时通讯服务器', 'success');
                setInputState(true);
            });

            socket.on('disconnect', (reason) => {
                console.log('Disconnected:', reason);
                showSystemMessage(`连接断开: ${reason}`, 'warning');
            });

            socket.on('reconnect', (attemptNumber) => {
                console.log('Reconnected after', attemptNumber, 'attempts');
                showSystemMessage('重新连接成功', 'success');
            });

            window.chatSocket = socket;
            return socket;

        } catch (error) {
            console.error('初始化Socket.IO时出错:', error);
            showSystemMessage(`实时通讯初始化失败: ${error.message}`, 'warning');
            return null;
        }
    }

	// 初始化marked渲染器
	function initializeMarkedRenderer() {
		return new Promise((resolve, reject) => {
			// 确保marked已加载
			if (typeof window.marked === 'undefined') {
				console.warn('等待marked库加载...');
				setTimeout(() => initializeMarkedRenderer().then(resolve).catch(reject), 100);
				return;
			}

			try {
				// 配置marked选项
				const renderer = new window.marked.Renderer();

				// 自定义代码块渲染
				renderer.code = function(code, language) {
					const validLanguage = !!(language && hljs.getLanguage(language));
					const highlighted = validLanguage ? hljs.highlight(code, { language }).value : code;
					return `<pre><code class="hljs ${language || ''}">${highlighted}</code></pre>`;
				};

				// 自定义表格渲染
				renderer.table = function(header, body) {
					return '<div class="table-container">\n' +
						'<table>\n' +
						(header ? '<thead>\n' + header + '</thead>\n' : '') +
						(body ? '<tbody>\n' + body + '</tbody>\n' : '') +
						'</table>\n' +
						'</div>\n';
				};

				renderer.tablerow = function(content) {
					return '<tr>\n' + content + '</tr>\n';
				};

				renderer.tablecell = function(content, flags) {
					const type = flags.header ? 'th' : 'td';
					const align = flags.align ? ` style="text-align: ${flags.align}"` : '';
					return `<${type}${align}>${content || '-'}</${type}>\n`;
				};

				// 配置marked选项
				window.marked.setOptions({
					renderer: renderer,
					gfm: true,
					tables: true,
					breaks: true,
					pedantic: false,
					sanitize: false,
					smartLists: true,
					smartypants: false,
					highlight: function(code, language) {
						if (language && hljs.getLanguage(language)) {
							try {
								return hljs.highlight(code, { language }).value;
							} catch (err) {
								console.error('代码高亮出错:', err);
							}
						}
						return code;
					}
				});

				console.log('marked渲染器初始化完成');
				resolve();
			} catch (error) {
				console.error('初始化marked渲染器时出错:', error);
				reject(error);
			}
		});
    }

    // 加载外部资源的函数
    async function loadExternalResources() {
        const resources = [
            {
                type: 'script',
				primary: '/chat/js/marked.min.js',
				fallback: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
				id: 'marked-js',
				onload: async () => {
					console.log('marked库加载完成');
					try {
						await initializeMarkedRenderer();
					} catch (error) {
						console.error('初始化marked渲染器失败:', error);
						throw error;
					}
				}
            },
            {
                type: 'style',
				primary: '/chat/css/github-dark.min.css',
                fallback: 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/github-dark.css',
                id: 'hljs-css'
            },
            {
                type: 'script',
				primary: '/chat/js/highlight.min.js',
                fallback: 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/highlight.min.js',
                id: 'hljs-js'
			},
			{
				type: 'script',
				primary: '/vendor/mathjax/es5/tex-chtml.js',
				fallback: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js',
				id: 'mathjax-js',
				async: true
            }
        ];

        try {
			showSystemMessage('正在加载资源...', 'info');

			// 首先配置MathJax
			window.MathJax = {
				tex: {
					inlineMath: [['$', '$'], ['\\(', '\\)']],
					displayMath: [['$$', '$$'], ['\\[', '\\]']],
					packages: { '[+]': ['ams', 'noerrors'] }
				},
				options: {
					skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
				}
			};

			// 然后加载资源
            for (const resource of resources) {
                await loadResource(resource);
            }

			console.log('所有资源加载完成');
			showSystemMessage('资源加载完成', 'success');
        } catch (error) {
            console.error('加载外部资源失败:', error);
            showSystemMessage('部分功能可能不可用', 'warning');
			throw error;
        }
    }

    // 加载单个资源的函数
    function loadResource(resource) {
        return new Promise((resolve, reject) => {
            const element = document.createElement(resource.type === 'script' ? 'script' : 'link');
            
            if (resource.type === 'script') {
                element.src = resource.primary;
            } else {
                element.rel = 'stylesheet';
                element.href = resource.primary;
            }
            
            element.id = resource.id;

			element.onload = () => {
				if (resource.onload) {
					resource.onload();
				}
				resolve();
			};

            element.onerror = () => {
                console.warn(`Primary ${resource.type} failed to load, trying fallback...`);
                if (resource.type === 'script') {
                    element.src = resource.fallback;
                } else {
                    element.href = resource.fallback;
                }
                element.onerror = () => reject(new Error(`Both primary and fallback ${resource.type} failed to load`));
            };

            document.head.appendChild(element);
        });
    }

    // 生成会话ID
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 清除对话历史
    async function clearHistory() {
        // 添加确认提示，防止意外清空对话
        if (elements.chatMessages.children.length > 0) {
            const confirmClear = window.confirm('确定要清除所有对话历史吗？');
            if (!confirmClear) {
                return; // 用户取消，不清空对话
            }
        }
        
        try {
            await fetch('/chat/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    sessionId: sessionId
                })
            });
            
            // 清空消息显示区域
            elements.chatMessages.innerHTML = '';
            showSystemMessage('对话历史已清除', 'success');
            setTimeout(() => {
                showSystemMessage('', '');
            }, 2000);
        } catch (error) {
            console.error('清除历史记录时出错:', error);
            showSystemMessage('清除历史记录失败', 'error');
            setTimeout(() => {
                showSystemMessage('', '');
            }, 2000);
        }
    }

    // 设置上传菜单相关功能
    function setupUploadMenu() {
        // 检查元素是否存在
        console.log('开始初始化上传菜单');
        
        // 重新获取元素（确保在DOM完全加载后）
        elements.addButton = document.getElementById('add-button');
        elements.uploadMenu = document.getElementById('upload-menu');
        elements.uploadFileOption = document.getElementById('upload-file-option');
        elements.fileUpload = document.getElementById('file-upload');
        
        console.log('上传菜单元素状态:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);
        
        if (!elements.addButton || !elements.uploadMenu) {
            console.error('上传菜单元素不存在，跳过初始化');
            return;
        }
        
        // 设置初始状态
        elements.uploadMenu.style.display = 'none';
        elements.uploadMenu.classList.remove('show');
        
        // 点击加号按钮显示/隐藏菜单
        elements.addButton.addEventListener('click', function(e) {
            console.log('加号按钮被点击');
            e.preventDefault();
            e.stopPropagation(); // 阻止事件冒泡
            toggleUploadMenu();
        });
        
        // 点击上传文件选项
        if (elements.uploadFileOption) {
            elements.uploadFileOption.addEventListener('click', function(e) {
                console.log('上传文件选项被点击');
                e.preventDefault();
                e.stopPropagation(); // 阻止事件冒泡
                if (elements.fileUpload) {
                    elements.fileUpload.click();
                }
                hideUploadMenu();
            });
        }
        
        // 处理文件上传
        if (elements.fileUpload) {
            elements.fileUpload.addEventListener('change', handleFileUpload);
        }
        
        // 点击其他区域关闭菜单
        document.addEventListener('click', function(e) {
            if (elements.uploadMenu && 
                elements.uploadMenu.style.display !== 'none' &&
                !elements.uploadMenu.contains(e.target) && 
                e.target !== elements.addButton && 
                !elements.addButton.contains(e.target)) {
                hideUploadMenu();
            }
        });
        
        console.log('上传菜单初始化完成');
    }

    // 切换上传菜单显示/隐藏
    function toggleUploadMenu() {
        console.log('切换上传菜单状态');
        if (!elements.uploadMenu) {
            console.error('上传菜单元素不存在，无法切换');
            return;
        }
        
        // 使用display属性判断菜单是否可见
        const isMenuVisible = elements.uploadMenu.style.display !== 'none';
        console.log('当前菜单是否可见:', isMenuVisible);
        
        if (isMenuVisible) {
            hideUploadMenu();
        } else {
            showUploadMenu();
        }
    }

    // 显示上传菜单
    function showUploadMenu() {
        console.log('显示上传菜单');
        if (!elements.uploadMenu) {
            console.error('上传菜单元素不存在，无法显示');
            return;
        }
        
        // 先设置display样式，再添加show类（确保过渡效果正常）
        elements.uploadMenu.style.display = 'block';
        
        // 使用requestAnimationFrame确保样式变化被应用
        requestAnimationFrame(() => {
            elements.uploadMenu.classList.add('show');
            console.log('上传菜单已显示，classList:', elements.uploadMenu.classList);
        });
    }

    // 隐藏上传菜单
    function hideUploadMenu() {
        console.log('隐藏上传菜单');
        if (!elements.uploadMenu) {
            console.error('上传菜单元素不存在，无法隐藏');
            return;
        }
        
        // 先移除show类
        elements.uploadMenu.classList.remove('show');
        console.log('移除show类后的classList:', elements.uploadMenu.classList);
        
        // 直接设置不可见，不再使用延时
        elements.uploadMenu.style.display = 'none';
        console.log('设置菜单为不可见');
    }

    // 处理文件上传
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        console.log('准备上传文件:', file.name, '文件大小:', file.size, 'bytes');
        
        // 显示上传进度提示
        showSystemMessage(`正在上传文件: ${file.name}`, 'info');
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        
        console.log('使用会话ID:', sessionId);
        
        // 发送文件到服务器
        fetch('/chat/upload', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
        })
        .then(response => {
            console.log('上传响应状态:', response.status);
            if (!response.ok) {
                // 根据不同的错误状态码提供更友好的错误信息
                if (response.status === 406) {
                    throw new Error('不支持的文件格式，请上传允许的文件类型');
                } else if (response.status === 413) {
                    throw new Error('文件太大，请选择小于10MB的文件');
                } else if (response.status === 415) {
                    throw new Error('不支持的文件类型');
                } else {
                    throw new Error('上传失败，请稍后重试');
                }
            }
            return response.json();
        })
        .then(data => {
            // 上传成功
            console.log('上传成功，服务器响应:', data);
            showSystemMessage('文件上传成功', 'success');
            
            // 在聊天区域显示上传的文件
            addMessage(`上传了文件: ${file.name}`, 'user');
            
            // 如果有文件URL，添加到聊天消息中
            if (data && data.fileUrl) {
                console.log('文件URL:', data.fileUrl);
                const fileMessage = createFileMessage(file.name, data.fileUrl);
                elements.chatMessages.appendChild(fileMessage);
                scrollToBottom();
            }
            
            // 重置文件输入框
            event.target.value = '';
        })
        .catch(error => {
            console.error('文件上传错误:', error);
            showSystemMessage(error.message || '文件上传失败，请重试', 'error');
            // 重置文件输入框
            event.target.value = '';
        });
    }

    // 创建文件消息元素
    function createFileMessage(fileName, fileUrl) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'message assistant';
        
        const senderDiv = document.createElement('div');
        senderDiv.className = 'message-sender';
        senderDiv.textContent = 'DeepSeek';
        fileDiv.appendChild(senderDiv);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // 根据文件类型显示不同的图标和处理方式
        const extension = fileName.split('.').pop().toLowerCase();
        let fileIcon = '📄'; // 默认文件图标
        let contentHtml = '';
        
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
            fileIcon = '🖼️';
            contentHtml = `
                <div class="file-attachment">
                    <div class="file-preview">
                        <img src="${fileUrl}" alt="${fileName}" style="max-width: 200px; max-height: 200px;">
                    </div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <a href="${fileUrl}" target="_blank" class="file-download">查看原图</a>
                    </div>
                </div>
            `;
        } else if (['pdf'].includes(extension)) {
            fileIcon = '📑';
            contentHtml = `
                <div class="file-attachment">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <a href="${fileUrl}" target="_blank" class="file-download">查看PDF</a>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="file-attachment">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <a href="${fileUrl}" target="_blank" class="file-download">下载文件</a>
                    </div>
                </div>
            `;
        }
        
        contentDiv.innerHTML = contentHtml;
        fileDiv.appendChild(contentDiv);
        return fileDiv;
    }

    // 添加会话状态跟踪
    const SessionStatus = {
        INITIALIZING: 'INITIALIZING',
        PROCESSING: 'PROCESSING',
        COMPLETED: 'COMPLETED',
        ERROR: 'ERROR'
    };

    let currentSessionStatus = SessionStatus.INITIALIZING;
    let lastError = null;

    function updateSessionStatus(status, error = null) {
        currentSessionStatus = status;
        lastError = error;
        
        // 更新UI状态
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status.toLowerCase()}`;
            statusIndicator.textContent = getStatusText(status);
        }
        
        // 如果有错误，显示错误信息
        if (error) {
            showErrorMessage(error);
        }
    }

    function getStatusText(status) {
        switch (status) {
            case SessionStatus.INITIALIZING:
                return '初始化中...';
            case SessionStatus.PROCESSING:
                return '处理中...';
            case SessionStatus.COMPLETED:
                return '已完成';
            case SessionStatus.ERROR:
                return '出错了';
            default:
                return '未知状态';
        }
    }

    function showErrorMessage(error) {
        const errorContainer = document.querySelector('.error-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    <h4>${error.errorType || '错误'}</h4>
                    <p>${error.errorDescription || error.message || '发生未知错误'}</p>
                    ${error.stackTrace ? `<pre class="error-stack">${error.stackTrace}</pre>` : ''}
                </div>
            `;
            errorContainer.style.display = 'block';
        }
    }

    // 处理作业上传
    async function handleHomeworkUpload(files) {
        try {
            // 添加防御性检查
            if (!files || typeof files !== 'object') {
                console.error('文件对象无效:', files);
                showSystemMessage('文件上传失败：无效的文件对象', 'error');
                return;
            }

            updateSessionStatus(SessionStatus.INITIALIZING);
            
            console.log('开始处理作业上传，文件列表:', files);
            
            // 使用Array.from之前进行类型检查
            const filesList = files.length !== undefined ? Array.from(files) : [];
            console.log('转换后的文件列表:', filesList);
            
            if (filesList.length === 0) {
                showSystemMessage('请选择作业文件', 'error');
                return;
            }
            
            if (filesList.length > 5) {
                showSystemMessage('一次最多只能上传5张图片', 'error');
                return;
            }

            // 检查每个文件对象的有效性
            for (let file of filesList) {
                if (!file || typeof file !== 'object') {
                    console.error('无效的文件对象:', file);
                    showSystemMessage('文件上传失败：文件格式错误', 'error');
                    return;
                }

                console.log('检查文件:', file.name, '类型:', file.type, '大小:', file.size);
                
                if (!file.type || !file.type.startsWith('image/')) {
                    showSystemMessage('只能上传图片文件', 'error');
                    return;
                }
                
                if (!file.size || file.size > 10 * 1024 * 1024) { // 10MB
                    showSystemMessage('图片大小不能超过10MB', 'error');
                    return;
                }
            }
            
            console.log('文件验证通过，显示科目选择对话框');
            
            // 显示科目选择对话框
            const subjectDialog = document.createElement('div');
            subjectDialog.className = 'subject-dialog';
            subjectDialog.innerHTML = `
                <div class="subject-dialog-content">
                    <h3>请选择作业科目</h3>
                    <div class="subject-options">
                        <button data-subject="chinese">语文</button>
                        <button data-subject="math">数学</button>
                        <button data-subject="english">英语</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(subjectDialog);
            
            // 处理科目选择
            subjectDialog.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', async () => {
                    try {
                        const subject = button.dataset.subject;
                        console.log('选择科目:', subject, '文件数量:', filesList.length);
                        document.body.removeChild(subjectDialog);
                        await uploadHomework(filesList, subject);
        } catch (error) {
                        console.error('处理科目选择时出错:', error);
                        showSystemMessage(`处理失败: ${error.message}`, 'error');
                    }
                });
            });
        } catch (error) {
            console.error('处理作业上传时出错:', error);
            updateSessionStatus(SessionStatus.ERROR, {
                message: error.message,
                errorType: 'UPLOAD_ERROR',
                errorDescription: '上传作业时发生错误'
            });
            showSystemMessage('文件上传失败：' + error.message, 'error');
        }
    }

    // 上传作业并获取批改结果
    async function uploadHomework(files, subject) {
        try {
            console.log('开始上传作业 - 文件数量:', files.length, '科目:', subject);
            
            if (!files || !Array.isArray(files) || files.length === 0) {
                throw new Error('请选择要批改的作业文件');
            }
            
            if (!subject || subject.trim() === '') {
                throw new Error('请选择作业科目');
            }
            
            showSystemMessage('正在上传作业...', 'info');
            
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
                console.log('添加文件到表单:', file.name, file.size, 'bytes');
            });
            formData.append('subject', subject);
            formData.append('sessionId', sessionId);
            
            console.log('准备发送请求 - 科目:', subject, '会话ID:', sessionId);
            
            // 创建消息容器
            const messageContainer = createMessageElement('assistant', '');
            elements.chatMessages.appendChild(messageContainer);
            messageContainer.querySelector('.message-content').innerHTML = '<div class="typing-indicator">正在批改作业...</div>';
            
            // 发送请求，添加完整的请求头
            const response = await fetch('/homework/check', {
                method: 'POST',
                headers: {
                    'Accept': 'text/event-stream, application/json, */*',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('服务器响应错误:', response.status, errorText);
                
                // 根据不同的错误状态码提供更友好的错误信息
                if (response.status === 406) {
                    throw new Error('服务器无法处理上传的文件格式，请确保上传的是图片文件');
                } else if (response.status === 413) {
                    throw new Error('文件太大，请压缩后再上传');
                } else if (response.status === 415) {
                    throw new Error('不支持的文件类型，请上传图片文件');
                } else {
                    throw new Error(`上传失败: ${errorText}`);
                }
            }
            
            // 检查响应类型
            const contentType = response.headers.get('content-type');
            if (!contentType || (!contentType.includes('text/event-stream') && !contentType.includes('application/json'))) {
                throw new Error('服务器返回了不支持的响应格式');
            }
            
            console.log('开始处理服务器响应');
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = ''; // 用于累积完整的内容
            
            while (true) {
                const {value, done} = await reader.read();
                if (done) {
                    console.log('响应流读取完成');
                    break;
                }
                
                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    // 处理事件流格式
                    if (line.startsWith('data:')) {
                        try {
                            const data = line.slice(5).trim();
                            
                            // 检查是否是结束标记
                            if (data === '[DONE]') {
                                console.log('收到[DONE]标记');
                                continue;
                            }
                            
                            // 解析JSON数据
                            const eventData = JSON.parse(data);
                            
                            if (eventData.error) {
                                updateSessionStatus(SessionStatus.ERROR, eventData);
                                break;
                            }
                            
                            // 累积内容
                            if (eventData.content) {
                                fullContent += eventData.content;
                                try {
                                    // 实时渲染累积的内容
                                    const renderedContent = marked.parse(fullContent);
                                    messageContainer.querySelector('.message-content').innerHTML = renderedContent;
                                    
                                    // 实时渲染数学公式
                                    if (typeof renderMathInElement === 'function') {
                                        renderMathInElement(messageContainer.querySelector('.message-content'), {
                                            delimiters: [
                                                {left: '$$', right: '$$', display: true},
                                                {left: '$', right: '$', display: false},
                                                {left: '\\(', right: '\\)', display: false},
                                                {left: '\\[', right: '\\]', display: true}
                                            ],
                                            throwOnError: false
                                        });
                                    }
                                } catch (renderError) {
                                    console.error('渲染内容时出错:', renderError);
                                }
                            }
                        } catch (e) {
                            console.error('处理数据时出错:', e);
                            if (e instanceof SyntaxError) {
                                console.log('JSON解析失败的原始数据:', line);
                            }
                        }
                    }
                }
            }
            
            // 处理剩余的buffer中的数据
            if (buffer.trim()) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        try {
                            const data = line.slice(5).trim();
                            if (data === '[DONE]') continue;
                            
                            const eventData = JSON.parse(data);
                            if (eventData.content) {
                                fullContent += eventData.content;
                            }
                        } catch (e) {
                            console.error('处理剩余数据时出错:', e);
                        }
                    }
                }
            }
            
            // 最终渲染
            console.log('准备渲染最终内容:', fullContent);
            try {
                const finalRenderedContent = marked.parse(fullContent);
                messageContainer.querySelector('.message-content').innerHTML = finalRenderedContent;
                
                // 最后一次渲染数学公式
                if (typeof renderMathInElement === 'function') {
                    renderMathInElement(messageContainer.querySelector('.message-content'), {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false},
                            {left: '\\(', right: '\\)', display: false},
                            {left: '\\[', right: '\\]', display: true}
                        ],
                        throwOnError: false
                    });
                }
            } catch (renderError) {
                console.error('最终渲染内容时出错:', renderError);
                // 如果渲染失败，显示原始内容
                messageContainer.querySelector('.message-content').textContent = fullContent;
            }
            
            // 滚动到底部
            scrollToBottom();
            
            updateSessionStatus(SessionStatus.COMPLETED);
        } catch (error) {
            console.error('作业批改失败:', error);
            updateSessionStatus(SessionStatus.ERROR, {
                message: error.message,
                errorType: 'UPLOAD_ERROR',
                errorDescription: '上传作业时发生错误'
            });
            showSystemMessage(error.message, 'error');
        }
    }

    // 添加移动端调试支持
    function initMobileDebug() {
        // 只保留基本的错误捕获功能
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            console.error('错误: ' + msg + '\n' +
                         '文件: ' + url + '\n' +
                         '行号: ' + lineNo + '\n' +
                         '列号: ' + columnNo + '\n' +
                         '错误对象: ' + JSON.stringify(error));
            return false;
        };
        
        // 添加Promise错误捕获
        window.onunhandledrejection = function(event) {
            console.error('Promise错误: ', event.reason);
        };
        
        // 添加基本的移动端信息日志
        console.log('移动端设备信息:', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            devicePixelRatio: window.devicePixelRatio,
            orientation: window.orientation
        });
    }

    // 在初始化函数中调用
    async function initializeChat() {
        try {
            // 检测是否为移动设备
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                console.log('检测到移动设备');
                initMobileDebug();
            }
            
            // 加载外部资源
            await loadExternalResources();

        // 自动聚焦输入框
        focusInput();

        // 设置输入框事件监听
        elements.messageInput.addEventListener('input', handleInput);
        
        // 添加键盘事件监听，处理回车发送消息
        elements.messageInput.addEventListener('keydown', handleKeyPress);

        // 设置表单提交事件
        elements.chatForm.addEventListener('submit', handleSubmit);

        // 设置消息观察器
        setupMessageObserver();
        
        // 监听历史状态变化
        window.addEventListener('popstate', handleHistoryChange);

        // 初始化 Socket.IO
        initializeSocketIO();

        // 调试元素初始化状态
        console.log('初始化前检查上传菜单相关元素:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);
        
        // 重新获取元素（确保在DOM完全加载后）
        elements.addButton = document.getElementById('add-button');
        elements.uploadMenu = document.getElementById('upload-menu');
        elements.uploadFileOption = document.getElementById('upload-file-option');
        elements.fileUpload = document.getElementById('file-upload');
        
        console.log('重新获取后的元素:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);

        // 设置上传菜单事件
        setupUploadMenu();
        
        // 设置作业上传事件监听
        const uploadHomeworkOption = document.querySelector('.upload-option[data-type="homework"]');
        if (uploadHomeworkOption) {
            console.log('找到作业上传选项元素');
            const homeworkInput = document.createElement('input');
            homeworkInput.type = 'file';
            homeworkInput.multiple = true;
            homeworkInput.accept = 'image/*';
            homeworkInput.style.display = 'none';
            document.body.appendChild(homeworkInput);
            
            uploadHomeworkOption.addEventListener('click', () => {
                console.log('作业上传选项被点击');
                hideUploadMenu();
                homeworkInput.click();
            });
            
            homeworkInput.addEventListener('change', (e) => {
                console.log('选择了作业文件:', e.target.files);
                handleHomeworkUpload(e.target.files);
                homeworkInput.value = ''; // 清空选择，允许重复选择相同文件
            });
        } else {
            console.warn('未找到作业上传选项元素');
        }

			// 所有初始化完成后启用输入框，但保持发送按钮禁用状态（直到有输入）
			setInputState(true);
            elements.sendButton.disabled = true; // 初始状态下输入框是空的，所以发送按钮应该是禁用的
			showSystemMessage('准备就绪', 'success');
		} catch (error) {
			console.error('初始化失败:', error);
			showSystemMessage('初始化失败，请刷新页面重试', 'error');
		}
    }

    // 添加学习报告按钮事件监听
    if (elements.showReportButton) {
        console.log('添加学习报告按钮事件监听器');
        elements.showReportButton.addEventListener('click', function() {
            console.log('学习报告按钮被点击');
            try {
                if (!sessionId) {
                    console.error('无法获取会话ID');
                    showSystemMessage('无法获取会话ID，请确保您在有效的聊天会话中', 'error');
                    return;
                }
                
                console.log('当前会话ID:', sessionId);
                if (window.learningAnalytics) {
                    window.learningAnalytics.displayLearningReport(sessionId);
                } else {
                    console.error('学习分析模块未加载');
                    showSystemMessage('学习分析功能未准备就绪，请刷新页面后重试', 'error');
                }
            } catch (error) {
                console.error('显示学习报告时出错:', error);
                showSystemMessage('显示学习报告时出错: ' + error.message, 'error');
            }
        });
        console.log('学习报告按钮事件监听器添加完成');
    } else {
        console.warn('未找到学习报告按钮元素');
    }
});
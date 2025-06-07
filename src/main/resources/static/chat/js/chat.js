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
        this.reportCache = new Map(); // 添加报告缓存
        this.currentReportModal = null; // 当前显示的报告模态框
        
        // 确保数据结构完整
        if (!this.data.questions) this.data.questions = {};
        if (!this.data.topics) this.data.topics = {};
        if (!this.data.sessionAnalytics) this.data.sessionAnalytics = {};
        if (!this.data.personalRecommendations) this.data.personalRecommendations = {};
        
        // 保存初始化的数据
        this.saveData();
        
        console.log('学习分析系统初始化完成:', this.data);
    }

    // 加载数据
    loadData() {
        try {
            console.log('开始加载学习数据');
            const stored = localStorage.getItem(this.STORAGE_KEY);
            let data = stored ? JSON.parse(stored) : {
                questions: {},           // 问题频率统计
                topics: {},             // 主题分布
                sessionAnalytics: {},    // 会话分析
                personalRecommendations: {} // 个性化建议
            };
            
            // 确保所有会话的 topics 是 Set 对象
            Object.values(data.sessionAnalytics || {}).forEach(session => {
                if (session && session.topics && !(session.topics instanceof Set)) {
                    session.topics = new Set(Array.from(session.topics || []));
                }
            });
            
            console.log('学习数据加载完成:', data);
            return data;
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
            // 数据验证
            if (!this.data) {
                console.error('保存数据失败：数据对象为空');
                return false;
            }

            // 确保所有必要的数据结构存在
            if (!this.data.questions) this.data.questions = {};
            if (!this.data.topics) this.data.topics = {};
            if (!this.data.sessionAnalytics) this.data.sessionAnalytics = {};
            if (!this.data.personalRecommendations) this.data.personalRecommendations = {};

            // 转换Set为数组以便存储
            Object.values(this.data.sessionAnalytics).forEach(session => {
                if (session && session.topics instanceof Set) {
                    session.topics = Array.from(session.topics);
                }
            });

            // 立即保存到localStorage
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            console.log('学习数据已保存:', this.data);
            return true;
        } catch (error) {
            console.error('保存学习数据时出错:', error);
            return false;
        }
    }

    // 记录新问题
    recordQuestion(question, sessionId) {
        console.log('记录问题:', question, '会话ID:', sessionId);
        
        // 从localStorage获取聊天历史以获取标题
        const chatHistory = localStorage.getItem('deepseek_chat_history');
        let currentChatTitle = '新对话';
        if (chatHistory) {
            const historyData = JSON.parse(chatHistory);
            const currentChat = historyData.find(chat => chat.id === sessionId);
            if (currentChat) {
                currentChatTitle = currentChat.title;
            }
        }

        if (!this.data.sessionAnalytics[sessionId]) {
            this.data.sessionAnalytics[sessionId] = {
                questions: [],
                lastUpdate: Date.now()
            };
        }

        const normalizedQuestion = this.normalizeQuestion(question);
        const topics = this.analyzeTopics(question);

        this.data.sessionAnalytics[sessionId].questions.push({
            question: normalizedQuestion,
            timestamp: new Date().toISOString(),
            topics: topics,
            title: currentChatTitle
        });

        this.data.sessionAnalytics[sessionId].lastUpdate = Date.now();
        this.saveData();
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
            // 重新加载数据以确保最新状态
            this.data = this.loadData();
            
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

            // 计算最新的会话时长
            const firstQuestionTime = sessionData.questions.length > 0 ? 
                sessionData.questions[0].timestamp : 
                sessionData.startTime;
            
            const lastQuestionTime = sessionData.questions.length > 0 ? 
                sessionData.questions[sessionData.questions.length - 1].timestamp : 
                sessionData.lastActive;

            // 使用最新的时间计算会话时长
            const sessionDuration = lastQuestionTime - firstQuestionTime;

            // 保存更新后的数据
            this.saveData();

            console.log('返回报告数据，会话时长:', sessionDuration);
            return {
                sessionDuration: sessionDuration,
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
    async displayLearningReport(sessionId) {
        console.log('开始生成学习报告，会话ID:', sessionId);
        try {
            // 检查数据同步状态
            if (!this.checkDataSync(sessionId)) {
                this.data = this.loadData();
            }
            
            // 检查是否有当前会话的数据
            const sessionData = this.data.sessionAnalytics[sessionId];
            if (!sessionData) {
                console.log('未找到当前会话的数据');
                // 创建一个空的报告模态框
                const modalDiv = this.createReportModal(sessionId);
                modalDiv.querySelector('#questions-history').innerHTML = '<p style="color: #666;">当前会话暂无学习数据</p>';
                modalDiv.querySelector('#improvement-suggestions').innerHTML = '<p style="color: #666;">开始提问以获取学习建议</p>';
                
                // 设置关闭按钮行为
                const closeButton = modalDiv.querySelector('.close-button');
                closeButton.onclick = (e) => {
                    e.stopPropagation();
                    modalDiv.style.display = 'none';
                };
                
                // 点击模态框外部关闭
                modalDiv.onclick = (e) => {
                    if (e.target === modalDiv) {
                        modalDiv.style.display = 'none';
                    }
                };
                
                document.body.appendChild(modalDiv);
                return;
            }
            
            // 检查是否有缓存的报告
            if (this.currentReportModal) {
                // 如果模态框已存在但隐藏，则显示它
                if (this.currentReportModal.style.display === 'none') {
                    this.currentReportModal.style.display = 'flex';
                    return;
                }
            }

            // 创建或获取模态框
            const modalDiv = this.createReportModal(sessionId);
            this.currentReportModal = modalDiv;
            
            // 设置关闭按钮行为
            const closeButton = modalDiv.querySelector('.close-button');
            closeButton.onclick = (e) => {
                e.stopPropagation();
                console.log('关闭按钮被点击');
                modalDiv.style.display = 'none';
            };
            
            // 点击模态框外部关闭
            modalDiv.onclick = (e) => {
                if (e.target === modalDiv) {
                    console.log('点击模态框外部，隐藏模态框');
                    modalDiv.style.display = 'none';
                }
            };

            // 如果已有模态框，先移除
            if (document.body.contains(this.currentReportModal)) {
                document.body.removeChild(this.currentReportModal);
            }

            // 添加到body
            document.body.appendChild(modalDiv);

            // 获取会话数据
            const questions = sessionData.questions || [];
            const questionsList = questions.map(q => ({
                question: q.question,
                timestamp: new Date(q.timestamp).toLocaleString(),
                topics: q.topics || []
            }));

            // 更新提问历史显示
            const questionsHistory = modalDiv.querySelector('#questions-history');
            if (questionsHistory) {
                if (questionsList.length === 0) {
                    questionsHistory.innerHTML = '<p style="color: #666;">当前会话暂无提问记录</p>';
                } else {
                    questionsHistory.innerHTML = questionsList.map(q => `
                        <div style="margin-bottom: 15px; padding: 10px; background: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <p style="margin: 0; color: #666; font-size: 0.9em;">${q.timestamp}</p>
                            <p style="margin: 5px 0; color: #333;">${q.question}</p>
                            <p style="margin: 0; color: #666; font-size: 0.9em;">主题: ${q.topics.join(', ') || '未分类'}</p>
                        </div>
                    `).join('');
                }
            }

            // 检查是否有缓存的建议
            const suggestionsDiv = modalDiv.querySelector('#improvement-suggestions');
            if (suggestionsDiv) {
                if (!this.reportCache.has(sessionId)) {
                    // 只在没有缓存时请求新数据
                    suggestionsDiv.innerHTML = '<p style="color: #666;">正在分析学习数据...</p>';
                    const suggestions = await this.fetchImprovementSuggestions(sessionId, questionsList);
                    this.reportCache.set(sessionId, suggestions);
                }
                
                // 显示建议（从缓存或新请求）
                suggestionsDiv.innerHTML = this.reportCache.get(sessionId);
                
                // 渲染数学公式
                if (window.MathJax && window.MathJax.typesetPromise) {
                    await window.MathJax.typesetPromise([suggestionsDiv]).catch((err) => {
                        console.error('MathJax渲染错误:', err);
                    });
                }
            }

            // 设置刷新按钮点击事件
            const refreshButton = modalDiv.querySelector('.refresh-button');
            refreshButton.onclick = async () => {
                console.log('刷新按钮被点击');
                try {
                    // 显示加载状态
                    refreshButton.disabled = true;
                    refreshButton.innerHTML = '🔄 刷新中...';
                    
                    // 重新加载数据
                    this.data = this.loadData();
                    
                    // 获取最新的会话数据
                    const sessionData = this.data.sessionAnalytics[sessionId];
                    if (!sessionData) {
                        throw new Error('无法获取会话数据');
                    }
                    
                    // 更新提问历史
                    const updatedQuestions = sessionData.questions || [];
                    const updatedQuestionsList = updatedQuestions.map(q => ({
                        question: q.question,
                        timestamp: new Date(q.timestamp).toLocaleString(),
                        topics: q.topics || []
                    }));
                    
                    // 更新提问历史显示
                    if (questionsHistory) {
                        if (updatedQuestionsList.length === 0) {
                            questionsHistory.innerHTML = '<p style="color: #666;">当前会话暂无提问记录</p>';
                        } else {
                            questionsHistory.innerHTML = updatedQuestionsList.map(q => `
                                <div style="margin-bottom: 15px; padding: 10px; background: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                    <p style="margin: 0; color: #666; font-size: 0.9em;">${q.timestamp}</p>
                                    <p style="margin: 5px 0; color: #333;">${q.question}</p>
                                    <p style="margin: 0; color: #666; font-size: 0.9em;">主题: ${q.topics.join(', ') || '未分类'}</p>
                                </div>
                            `).join('');
                        }
                    }
                    
                    // 获取新的建议并更新缓存
                    if (suggestionsDiv) {
                        suggestionsDiv.innerHTML = '<p style="color: #666;">正在重新分析学习数据...</p>';
                        try {
                            const newSuggestions = await this.fetchImprovementSuggestions(sessionId, updatedQuestionsList);
                            // 先更新缓存
                            this.reportCache.set(sessionId, newSuggestions);
                            
                            // 如果模态框还在显示，则更新显示
                            if (modalDiv.style.display !== 'none') {
                                suggestionsDiv.innerHTML = newSuggestions;
                                
                                // 重新渲染数学公式
                                if (window.MathJax && window.MathJax.typesetPromise) {
                                    await window.MathJax.typesetPromise([suggestionsDiv]).catch((err) => {
                                        console.error('MathJax渲染错误:', err);
                                    });
                                }
                            }
                        } catch (fetchError) {
                            console.error('获取建议时出错:', fetchError);
                            // 如果获取失败，不清除原有缓存
                            if (this.reportCache.has(sessionId)) {
                                suggestionsDiv.innerHTML = this.reportCache.get(sessionId);
                            } else {
                                suggestionsDiv.innerHTML = '<div class="error-message">获取数据失败，请重试</div>';
                            }
                        }
                    }
                    
                    // 恢复刷新按钮状态
                    refreshButton.disabled = false;
                    refreshButton.innerHTML = '🔄 刷新';
                    
                    console.log('报告刷新完成，缓存已更新');
                } catch (error) {
                    console.error('刷新报告时出错:', error);
                    refreshButton.disabled = false;
                    refreshButton.innerHTML = '🔄 刷新';
                    showSystemMessage('刷新报告时出错: ' + error.message, 'error');
                }
            };

        } catch (error) {
            console.error('显示学习报告时出错:', error);
            showSystemMessage('显示学习报告时出错: ' + error.message, 'error');
        }
    }

    // 在updateDOM函数之前添加新的refreshReportData方法
    async refreshReportData(sessionId) {
        console.log('==================== 开始刷新报告 ====================');
        console.log('当前会话ID:', sessionId);
        try {
            // 从localStorage获取聊天历史
            const chatHistory = localStorage.getItem('deepseek_chat_history');
            console.log('获取到的聊天历史:', chatHistory);
            
            if (!chatHistory) {
                console.log('未找到聊天历史记录');
                return;
            }

            // 解析聊天历史
            const historyData = JSON.parse(chatHistory);
            console.log('解析后的历史数据:', historyData);
            
            // 查找当前会话的信息
            const currentChat = historyData.find(chat => chat.id === sessionId);
            console.log('当前会话信息:', currentChat);
            
            if (!currentChat) {
                console.log('未找到当前会话信息');
                return;
            }
            const currentChatTitle = currentChat.title;
            console.log('当前会话标题:', currentChatTitle);

            // 获取或初始化学习分析数据
            let analyticsData = localStorage.getItem('learning_analytics');
            console.log('获取到的学习分析数据:', analyticsData);
            
            if (!analyticsData) {
                analyticsData = '{}';
            }
            let analytics = JSON.parse(analyticsData);
            console.log('解析后的学习分析数据:', analytics);

            // 确保会话数据存在
            if (!analytics.sessionAnalytics) {
                analytics.sessionAnalytics = {};
            }
            if (!analytics.sessionAnalytics[sessionId]) {
                analytics.sessionAnalytics[sessionId] = {
                    questions: [],
                    lastUpdate: Date.now()
                };
            }

            // 更新会话数据
            const sessionData = analytics.sessionAnalytics[sessionId];
            console.log('当前会话的学习数据:', sessionData);
            
            if (!sessionData.questions) {
                sessionData.questions = [];
            }

            // 如果存在问题记录，更新标题
            if (sessionData.questions.length > 0) {
                console.log('更新前的问题列表:', sessionData.questions);
                sessionData.questions.forEach(question => {
                    question.title = currentChatTitle;
                });
                console.log('更新后的问题列表:', sessionData.questions);
            }

            // 保存更新后的数据
            localStorage.setItem('learning_analytics', JSON.stringify(analytics));
            this.data = analytics;
            console.log('保存的最新数据:', this.data);

            // 更新报告显示
            if (this.currentReportModal) {
                const questionsHistory = this.currentReportModal.querySelector('#questions-history');
                const suggestionsDiv = this.currentReportModal.querySelector('#improvement-suggestions');
                
                if (questionsHistory) {
                    const questions = sessionData.questions || [];
                    console.log('准备显示的问题列表:', questions);
                    
                    const questionsList = questions.map(q => ({
                        question: q.question,
                        timestamp: new Date(q.timestamp).toLocaleString(),
                        topics: q.topics || [],
                        title: currentChatTitle // 使用当前会话的标题
                    }));
                    console.log('格式化后的问题列表:', questionsList);

                    if (questionsList.length === 0) {
                        questionsHistory.innerHTML = '<p style="color: #666;">当前会话暂无提问记录</p>';
                    } else {
                        questionsHistory.innerHTML = questionsList.map(q => `
                            <div style="margin-bottom: 15px; padding: 10px; background: white; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <p style="margin: 0; color: #666; font-size: 0.9em;">${q.timestamp}</p>
                                <p style="margin: 5px 0; color: #333;">${q.question}</p>
                                <p style="margin: 0; color: #666; font-size: 0.9em;">标题: ${q.title}</p>
                                <p style="margin: 0; color: #666; font-size: 0.9em;">主题: ${q.topics.join(', ') || '未分类'}</p>
                            </div>
                        `).join('');
                    }
                }

                // 获取新的建议
                if (suggestionsDiv && sessionData.questions.length > 0) {
                    suggestionsDiv.innerHTML = '<p style="color: #666;">正在重新分析学习数据...</p>';
                    
                    // 构建请求内容，使用当前会话的最新问题
                    const latestQuestion = sessionData.questions[sessionData.questions.length - 1];
                    console.log('最新的问题记录:', latestQuestion);
                    
                    const requestData = {
                        question: `基于以下学习历史，请分析我需要加强哪些主题，并给出具体的改进建议：\n问题：${currentChatTitle}\n时间：${new Date(latestQuestion.timestamp).toLocaleString()}\n`,
                        sessionId: sessionId
                    };
                    console.log('准备发送的请求数据:', requestData);

                    // 发送请求到服务器
                    console.log('开始发送请求...');
                    const response = await fetch('/chat/stream', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestData)
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    // 处理流式响应
                    console.log('开始处理流式响应...');
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let fullContent = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            console.log('流式响应接收完成');
                            break;
                        }

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (!line.trim() || !line.startsWith('data:')) continue;
                            const data = line.slice(5).trim();
                            if (data === '[DONE]') continue;

                            try {
                                const jsonData = JSON.parse(data);
                                if (jsonData && jsonData.content !== undefined) {
                                    fullContent += jsonData.content;
                                }
                            } catch (jsonError) {
                                console.warn('解析JSON数据时出错:', jsonError);
                                console.warn('问题数据:', line);
                            }
                        }
                    }

                    console.log('获取到的完整响应:', fullContent);

                    // 更新建议显示
                    this.reportCache.set(sessionId, fullContent);
                    suggestionsDiv.innerHTML = fullContent;

                    // 重新渲染数学公式
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        console.log('开始渲染数学公式...');
                        await window.MathJax.typesetPromise([suggestionsDiv]);
                        console.log('数学公式渲染完成');
                    }
                }
            }

            console.log('==================== 刷新报告完成 ====================');
        } catch (error) {
            console.error('刷新报告数据时出错:', error);
            console.error('错误堆栈:', error.stack);
            showSystemMessage('刷新报告数据时出错: ' + error.message, 'error');
        }
    }

    // 获取主题改进建议
    async fetchImprovementSuggestions(sessionId, questionsList) {
        console.log('获取学习建议，会话ID:', sessionId);
        console.log('问题列表:', questionsList);
        
        try {
            if (!questionsList || questionsList.length === 0) {
                return '<p style="color: #666;">当前会话暂无提问记录，无法生成建议</p>';
            }

            // 构建请求内容
            const prompt = `基于以下学习历史，请分析我需要加强哪些主题，并给出具体的改进建议：\n${
                questionsList.map(q => `问题：${q.question}\n时间：${q.timestamp}\n`).join('\n')
            }`;

            // 发送请求到服务器
            const response = await fetch('/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question: prompt,
                    sessionId: sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                // 解码当前块
                buffer += decoder.decode(value, { stream: true });
                
                // 按行分割
                const lines = buffer.split('\n');
                // 保留最后一个可能不完整的行
                buffer = lines.pop() || '';
                
                // 处理完整的行
                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    if (line.startsWith('data:')) {
                        const data = line.slice(5).trim();
                        
                        // 如果是[DONE]标记，跳过
                        if (data === '[DONE]') {
                            continue;
                        }
                        
                        try {
                            const jsonData = JSON.parse(data);
                            if (jsonData && jsonData.content !== undefined) {
                                fullContent += jsonData.content;
                            }
                        } catch (jsonError) {
                            console.warn('解析JSON数据时出错:', jsonError);
                            continue;
                        }
                    }
                }
            }

            // 处理最后可能剩余的数据
            if (buffer) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data:')) continue;
                    
                    const data = line.slice(5).trim();
                    if (data === '[DONE]') continue;
                    
                    try {
                        const jsonData = JSON.parse(data);
                        if (jsonData && jsonData.content !== undefined) {
                            fullContent += jsonData.content;
                        }
                    } catch (jsonError) {
                        console.warn('解析最后的JSON数据时出错:', jsonError);
                    }
                }
            }

            // 使用marked处理Markdown格式
            let htmlContent;
            try {
                // 保护数学公式
                const mathExpressions = [];
                let mathIndex = 0;

                // 临时替换数学公式
                const contentWithPlaceholders = fullContent.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
                    mathExpressions.push(match);
                    return `%%MATH_EXPR_${mathIndex++}%%`;
                });

                // 使用marked渲染Markdown
                htmlContent = marked.parse(contentWithPlaceholders);

                // 恢复数学公式
                htmlContent = htmlContent.replace(/%%MATH_EXPR_(\d+)%%/g, (_, index) => mathExpressions[index]);
            } catch (renderError) {
                console.error('渲染Markdown内容时出错:', renderError);
                htmlContent = fullContent; // 如果渲染失败，使用原始内容
            }

            // 返回格式化后的HTML内容
            return `<div class="suggestions-content">
                ${htmlContent}
            </div>`;

        } catch (error) {
            console.error('获取学习建议时出错:', error);
            return '<div class="error-message">获取学习建议失败，请重试</div>';
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

    // 添加数据同步检查方法
    checkDataSync(sessionId) {
        try {
            // 从localStorage重新加载数据
            const storedData = localStorage.getItem(this.STORAGE_KEY);
            if (!storedData) {
                console.warn('localStorage中没有找到数据');
                return false;
            }

            const parsedData = JSON.parse(storedData);
            const currentSessionData = parsedData.sessionAnalytics[sessionId];
            const memorySessionData = this.data.sessionAnalytics[sessionId];

            if (!currentSessionData || !memorySessionData) {
                console.warn('会话数据不完整');
                return false;
            }

            // 比较问题数量
            const storedQuestionCount = currentSessionData.questions?.length || 0;
            const memoryQuestionCount = memorySessionData.questions?.length || 0;

            if (storedQuestionCount !== memoryQuestionCount) {
                console.log('检测到数据不同步，正在同步...');
                this.data = parsedData;
                return false;
            }

            return true;
        } catch (error) {
            console.error('检查数据同步时出错:', error);
            return false;
        }
    }

    // 创建报告模态框
    createReportModal(sessionId) {
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

        // 添加刷新按钮
        const refreshButton = document.createElement('button');
        refreshButton.innerHTML = '🔄 刷新';
        refreshButton.className = 'refresh-button';
        refreshButton.style.cssText = `
            position: absolute;
            right: 50px;
            top: 10px;
            padding: 5px 10px;
            font-size: 14px;
            cursor: pointer;
            background: #1a73e8;
            border: none;
            border-radius: 4px;
            color: white;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: background-color 0.3s;
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
                <h4 style="color: #1a73e8; margin-bottom: 15px;">提问历史</h4>
                <div id="questions-history" style="max-height: 300px; overflow-y: auto;">
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
        content.appendChild(refreshButton);
        content.appendChild(reportContent);
        modalDiv.appendChild(content);

        return modalDiv;
    }

    // 更新报告内容
    updateReportContent(modalDiv, report) {
        const contentDiv = modalDiv.querySelector('.report-modal-content');
        contentDiv.innerHTML = `
            <h3 style="margin-bottom: 20px; color: #333;">学习报告</h3>
            
            <div class="report-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="color: #1a73e8; margin-bottom: 15px;">提问历史</h4>
                <div id="questions-history" style="max-height: 300px; overflow-y: auto;">
                    ${report.questions.map(q => `
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
                    ${report.weakTopics.map(topic => `
                        <p style="color: #666;">${topic.message}</p>
                    `).join('')}
                </div>
            </div>

            <div class="report-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="color: #1a73e8; margin-bottom: 15px;">建议的学习资源</h4>
                <div id="suggested-resources" style="min-height: 50px;">
                    ${report.suggestedResources.map(resource => `
                        <p style="color: #666;">${resource.resources.map(res => `<a href="${res}" target="_blank">${res}</a>`).join(', ')}</p>
                    `).join('')}
                </div>
            </div>

            <div class="report-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="color: #1a73e8; margin-bottom: 15px;">学习路径建议</h4>
                <div id="learning-path" style="min-height: 50px;">
                    ${report.learningPath.map(step => `
                        <p style="color: #666;">${step.steps.join(' -> ')}</p>
                    `).join('')}
                </div>
            </div>

            <div class="report-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                <h4 style="color: #1a73e8; margin-bottom: 15px;">时间管理建议</h4>
                <div id="time-management" style="min-height: 50px;">
                    ${report.timeManagement.map(tip => `
                        <p style="color: #666;">${tip}</p>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

// 创建学习分析实例
const learningAnalytics = new LearningAnalytics();

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
        showReportButton: document.getElementById('show-report'),  // 添加学习报告按钮
        stopButton: document.getElementById('stop-button')  // 添加停止按钮
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
        
        console.log('添加会话到历史记录:', chatName, sessionId, '是否激活:', isActive); // 调试输出
        
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
        if (isActive) {
            // 移除其他链接的active状态
            document.querySelectorAll('.chat-link').forEach(link => {
                link.classList.remove('active');
            });
            chatLink.classList.add('active');
        }
        chatLink.setAttribute('data-chat-id', sessionId);

        // 创建标题容器
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-title';
        titleSpan.textContent = chatName;
        chatLink.appendChild(titleSpan);

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
            return false;
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
        
        // 设置普通作业上传和高级版作业上传事件监听
        const uploadOptions = {
            homework: document.querySelector('.upload-option[data-type="homework"]'),
            homeworkPro: document.querySelector('.upload-option[data-type="homework-pro"]')
        };
        
        // 处理普通作业上传
        if (uploadOptions.homework) {
            console.log('找到普通作业上传选项元素');
            const homeworkInput = document.createElement('input');
            homeworkInput.type = 'file';
            homeworkInput.multiple = true;
            homeworkInput.accept = 'image/*';
            homeworkInput.style.display = 'none';
            document.body.appendChild(homeworkInput);
            
            uploadOptions.homework.addEventListener('click', () => {
                console.log('普通作业上传选项被点击');
                hideUploadMenu();
                homeworkInput.click();
            });
            
            homeworkInput.addEventListener('change', (e) => {
                console.log('选择了普通作业文件:', e.target.files);
                handleHomeworkUpload(e.target.files);
                homeworkInput.value = ''; // 清空选择，允许重复选择相同文件
            });
        } else {
            console.warn('未找到普通作业上传选项元素');
        }

        // 处理高级版作业上传
        if (uploadOptions.homeworkPro) {
            console.log('找到高级版作业上传选项元素');
            const homeworkProInput = document.createElement('input');
            homeworkProInput.type = 'file';
            homeworkProInput.multiple = true;
            homeworkProInput.accept = 'image/*';
            homeworkProInput.style.display = 'none';
            document.body.appendChild(homeworkProInput);
            
            uploadOptions.homeworkPro.addEventListener('click', () => {
                console.log('高级版作业上传选项被点击');
                hideUploadMenu();
                homeworkProInput.click();
            });
            
            homeworkProInput.addEventListener('change', (e) => {
                console.log('选择了高级版作业文件:', e.target.files);
                handleHomeworkProUpload(e.target.files);
                homeworkProInput.value = ''; // 清空选择，允许重复选择相同文件
            });
        } else {
            console.warn('未找到高级版作业上传选项元素');
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
        
		if (isMobile && event.key === 'Enter') {
		    // 移动设备下，Enter 键统一处理为换行
		    event.preventDefault();  // 阻止默认行为
		    if (event.type === 'keydown') {  // 确保只在 keydown 时插入换行
                insertNewline(event.target);
            }
		    return false;  // 阻止事件冒泡
        }
        // 桌面端处理：按下Enter键且没有按下Shift键和Alt键，则发送消息
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            const isEmpty = !event.target.value.trim();
            if (!isEmpty) {
                handleSubmit(event);
            } else {
                if (navigator.vibrate) {
                    navigator.vibrate(100);
                }
            }
        } else if (event.key === 'Enter' && (event.shiftKey || event.altKey)) {
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
            
        input.value = beforeCursor + '\n' + afterCursor;
        input.selectionStart = input.selectionEnd = start + 1;
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
					.replace(/\r\n|\r/g, '\n') // 统一换行符，兼容Windows和Unix
					.replace(/\n/g, '<br>')  // 换行转换为<br>
					.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // 粗体
					.replace(/\*(.*?)\*/g, '<em>$1</em>')  // 斜体
					.replace(/`([^`]+)`/g, '<code>$1</code>')  // 行内代码
					.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')  // 代码块
					.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')  // 链接
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

            // 显示停止按钮
            elements.stopButton.style.display = '';

            // 创建AbortController
            streamAbortController = new AbortController();

            // 发送请求
            const response = await fetch('/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
				body: JSON.stringify({ 
				    question: question,
				    sessionId: sessionId || '',
				    searchOptions: searchOptions // 只在这里用
				}),
                signal: streamAbortController.signal
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
                if (streamAbortController.signal.aborted) {
                    // 终止流式响应
                    break;
                }
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
                        if (line.startsWith('data:')) {
                            const data = line.slice(5).trim();
                            if (data === '[DONE]') {
                                console.log('收到[DONE]标记，处理完成');
                                break;
                            }
                            try {
                                const jsonData = JSON.parse(data);
                                if (!messageContainer) {
                                    messageContainer = createMessageElement('assistant', '');
                                    if (elements.chatMessages) {
                                        elements.chatMessages.appendChild(messageContainer);
                                    }
                                }
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
            elements.stopButton.style.display = 'none';
            streamAbortController = null;
        } catch (error) {
            if (error.name === 'AbortError') {
                showSystemMessage('已停止接收', 'warning');
            } else {
                console.error('请求出错:', error);
                showSystemMessage(error.message, 'error');
            }
            setInputState(true);
            elements.stopButton.style.display = 'none';
            streamAbortController = null;
        }
    }

    // 处理表单提交
    async function handleSubmit(event) {
        event.preventDefault();
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            // 移动端不允许直接提交
            return false;
        }
        const question = elements.messageInput.value.trim();
        
        // 检查消息是否为空
        if (!question) {
            // 消息为空，不提交
            console.log('消息为空，不提交');
            // 针对移动设备，添加振动反馈（如果支持）
            if (navigator.vibrate) {
                navigator.vibrate(100); // 轻微振动100毫秒
            }
            return; // 直接返回，不执行后续代码
        }
        
            // 立即清空并重置输入框
            elements.messageInput.value = '';
            elements.messageInput.style.height = 'auto';
            elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
            
            // 禁用输入和发送按钮
            setInputState(false);
            
            try {
            // 获取当前会话ID
            const sessionId = getSessionIdFromUrl();
            
            // 记录问题到学习分析系统
            learningAnalytics.recordQuestion(question, sessionId);
            
            // 检查是否是第一条消息
            const isFirstMessage = elements.chatMessages.children.length === 0;
            
            // 发送消息
                await askQuestionStreamPost(question);
            
            // 如果是第一条消息，将其作为对话标题
            if (isFirstMessage) {
                // 使用前20个字符作为标题，如果超过20字符则添加省略号
                const title = question.length > 20 ? question.substring(0, 20) + '...' : question;
                updateChatTitle(title);
            }
            } catch (error) {
                console.error('发送消息时出错:', error);
                showSystemMessage('发送消息失败，请重试', 'error');
                setInputState(true);
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
        div.className = `message ${isUser ? 'user' : 'ai-message'}`;
		div.innerHTML = `            <div class="message-sender">${sender}</div>
            <div class="message-content">${content}</div>
        `;
        return div;
    }

    // 添加消息到聊天区域
    function addMessage(content, type) {
        const messageDiv = document.createElement('div');
		messageDiv.className = `message ${type === 'user' ? 'user' : 'ai-message'}`;
        
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
		    // 新增：判断是否为复合类型
		    if (typeof content === 'object' && content.type === 'imageText') {
		        // 渲染图片和文本
		        const imgHtml = content.images.map(src => `<img src="${src}" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin: 4px 8px 4px 0;">`).join('');
		        // 处理配文中的数学公式
		        const mathExpressions = [];
		        let mathIndex = 0;
		        const textWithPlaceholders = content.text.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
		            mathExpressions.push(match);
		            return `%%MATH_EXPR_${mathIndex++}%%`;
		        });
		        let processedText = textWithPlaceholders
		            .replace(/&/g, "&amp;")
		            .replace(/</g, "&lt;")
		            .replace(/>/g, "&gt;");
		        const finalText = processedText.replace(/%%MATH_EXPR_(\d+)%%/g, (_, index) => mathExpressions[index]);
		        const textHtml = `<div style="margin-top:8px;">${finalText}</div>`;
		        contentDiv.innerHTML = imgHtml + textHtml;
		        // 触发MathJax渲染
		        if (window.MathJax && window.MathJax.typesetPromise) {
		            window.MathJax.typesetPromise([contentDiv]).catch((err) => {
		                console.error('MathJax渲染错误:', err);
		            });
		        }
		    } else {
		        // 原有逻辑
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
	    // 如果当前对话有消息，弹出确认提示
	    if (elements.chatMessages.children.length > 0) {
	        const confirmNewChat = window.confirm('开始新对话将清空当前对话内容，确定继续吗？');
	        if (!confirmNewChat) {
	            return; // 用户取消操作
	        }
	    }

	    // 生成新的会话ID
	    const newSessionId = generateSessionId();

	    // 移除所有侧边栏链接的活动状态
	    document.querySelectorAll('.chat-link').forEach(link => {
	        link.classList.remove('active');
	    });

	    // 在侧边栏添加新的对话，并设置为活动状态
	    addChatToHistory('新对话', newSessionId, true);

	    // 更新当前会话ID
	    sessionId = newSessionId;

	    // 清空消息显示区域
	    elements.chatMessages.innerHTML = '';

	    // 更新URL以反映新的会话ID
	    const newUrl = `/chat/s/${newSessionId}`;
	    window.history.pushState({ sessionId: newSessionId }, '', newUrl);

	    // 如果启用了学习分析功能，则重置相关数据
	    if (learningAnalytics) {
	        // 清除当前报告模态框
	        if (learningAnalytics.currentReportModal && document.body.contains(learningAnalytics.currentReportModal)) {
	            document.body.removeChild(learningAnalytics.currentReportModal);
	        }
	        learningAnalytics.currentReportModal = null;

	        // 清除报告缓存
	        learningAnalytics.reportCache.clear();

	        // 初始化新会话的数据结构
	        if (!learningAnalytics.data.sessionAnalytics[newSessionId]) {
	            learningAnalytics.data.sessionAnalytics[newSessionId] = {
	                questions: [],          // 记录提问的问题
	                topics: new Set(),     // 记录讨论的主题
	                startTime: Date.now(), // 记录会话开始时间
	                lastActive: Date.now() // 记录最后活跃时间
	            };
	            learningAnalytics.saveData(); // 保存数据到持久化存储
	        }
	    }

	    // 显示欢迎消息
	    showSystemMessage('已创建新对话', 'success');

	    // 延迟100毫秒后聚焦到输入框
	    setTimeout(() => {
	        focusInput();
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

				// 新增：自定义link渲染，所有链接都加target="_blank"
				renderer.link = function(href, title, text) {
					let out = `<a href="${href}" target="_blank" rel="noopener noreferrer"`;
					if (title) out += ` title="${title}"`;
					out += `>${text}</a>`;
					return out;
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
			        inlineMath: [
			            ['$', '$'],
			            ['\\(', '\\)']  // 添加这行确保支持 \(...\) 格式
			        ],
			        displayMath: [
			            ['$$', '$$'],
			            ['\\[', '\\]']
			        ],
			        packages: ['base', 'ams', 'noerrors', 'noundefined']
				},
				options: {
					skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
			    },
			    startup: {
			        ready: () => {
			            console.log('MathJax is loaded and ready');
			            MathJax.startup.defaultReady();
			        }
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
        const uploadMenu = document.getElementById('upload-menu');
        const addButton = document.getElementById('add-button');
        
        if (!uploadMenu || !addButton) {
            console.error('未找到上传菜单或添加按钮元素');
            return;
        }

        // 设置菜单显示/隐藏
        addButton.addEventListener('click', toggleUploadMenu);
        
        // 点击其他区域时隐藏菜单
        document.addEventListener('click', (event) => {
            if (!uploadMenu.contains(event.target) && !addButton.contains(event.target)) {
                hideUploadMenu();
            }
        });
    }

    // 切换上传菜单显示/隐藏
    function toggleUploadMenu() {
        // 检查上传菜单是否存在
        if (!elements.uploadMenu) {
            console.warn('上传菜单元素不存在');
            return;
        }
        
        // 使用getComputedStyle来检查菜单当前是否可见，更可靠
        const computedStyle = window.getComputedStyle(elements.uploadMenu);
        const isMenuVisible = computedStyle.display !== 'none';
        console.log('上传菜单当前显示状态:', isMenuVisible, '计算样式:', computedStyle.display);
        
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
            if (!files || typeof files !== 'object') {
                console.error('文件对象无效:', files);
                showSystemMessage('文件上传失败：无效的文件对象', 'error');
                return;
            }
            updateSessionStatus(SessionStatus.INITIALIZING);
            console.log('开始处理作业上传，文件列表:', files);
            const filesList = files.length !== undefined ? Array.from(files) : [];
            if (filesList.length === 0) {
                showSystemMessage('请选择作业文件', 'error');
                return;
            }
            if (filesList.length > 5) {
                showSystemMessage('一次最多只能上传5张图片', 'error');
                return;
            }
            for (let file of filesList) {
                if (!file || typeof file !== 'object') {
                    console.error('无效的文件对象:', file);
                    showSystemMessage('文件上传失败：文件格式错误', 'error');
                    return;
                }
                if (!file.type || !file.type.startsWith('image/')) {
                    showSystemMessage('只能上传图片文件', 'error');
                    return;
                }
                if (!file.size || file.size > 10 * 1024 * 1024) {
                    showSystemMessage('图片大小不能超过10MB', 'error');
                    return;
                }
            }
            
            // 弹窗
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
                <div style="margin-top: 16px;">
                    <label>
                        <input type="checkbox" id="customPromptCheck"> 自定义提示词
                    </label>
                    <textarea id="customPromptArea" style="display:none;width:100%;margin-top:8px;" placeholder="请输入自定义提示词"></textarea>
                </div>
                <div style="margin-top: 16px; text-align: right; display:none;" id="customPromptBtns">
                    <button id="subjectConfirmBtn" style="margin-right: 8px;">确定</button>
                    <button id="subjectCancelBtn">取消</button>
                </div>
                </div>
            `;
            const customPromptCheck = subjectDialog.querySelector('#customPromptCheck');
            const customPromptArea = subjectDialog.querySelector('#customPromptArea');
            const confirmBtn = subjectDialog.querySelector('#subjectConfirmBtn');
            const cancelBtn = subjectDialog.querySelector('#subjectCancelBtn');
            const customPromptBtns = subjectDialog.querySelector('#customPromptBtns');
            const subjectBtns = subjectDialog.querySelectorAll('.subject-options button');
            // 默认：科目按钮可用，确定/取消按钮隐藏
            customPromptCheck.addEventListener('change', function() {
                if (this.checked) {
                    customPromptArea.style.display = 'block';
                    customPromptBtns.style.display = 'block';
                    subjectBtns.forEach(btn => btn.disabled = true);
                } else {
                    customPromptArea.style.display = 'none';
                    customPromptBtns.style.display = 'none';
                    subjectBtns.forEach(btn => btn.disabled = false);
                }
            });
            // 科目按钮：点击后立即上传
            subjectBtns.forEach(button => {
                button.addEventListener('click', async () => {
                        const subject = button.dataset.subject;
                        document.body.removeChild(subjectDialog);
						// 移除预览气泡
						const previewMsg = document.querySelector('.preview-message');
						if (previewMsg) previewMsg.remove();
                    await uploadHomework(filesList, subject, '');
                });
            });
            // 确定按钮：上传自定义
            confirmBtn.addEventListener('click', async () => {
                const customPrompt = customPromptArea.value.trim();
                if (!customPrompt) {
                    showSystemMessage('请输入自定义提示词', 'error');
                    return;
                }
                document.body.removeChild(subjectDialog);
				// 移除预览气泡
				const previewMsg = document.querySelector('.preview-message');
				if (previewMsg) previewMsg.remove();
                await uploadHomework(filesList, 'customs', customPrompt);
            });
            // 取消按钮
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(subjectDialog);
            });
            document.body.appendChild(subjectDialog);
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
    async function uploadHomework(files, subject, customPrompt) {
        try {
            console.log('开始上传作业 - 文件数量:', files.length, '科目:', subject);
            if (!files || !Array.isArray(files) || files.length === 0) {
                throw new Error('请选择要批改的作业文件');
            }
            if (!subject || subject.trim() === '') {
                throw new Error('请选择作业科目');
            }
            showSystemMessage('正在上传图片...', 'info');
			// 如果是自定义提示词，插入一条用户文本消息
			if (subject === 'customs' && customPrompt && customPrompt.trim() !== '') {
			    await Promise.all(files.map(file => {
			        return new Promise(resolve => {
			            const reader = new FileReader();
			            reader.onload = function(e) {
			                resolve(e.target.result);
			            };
			            reader.readAsDataURL(file);
			        });
			    })).then(imgSrcs => {
			        addMessage({
			            type: 'imageText',
			            images: imgSrcs,
			            text: customPrompt
			        }, 'user');
			    });
			}
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
                console.log('添加文件到表单:', file.name, file.size, 'bytes');
            });
            formData.append('subject', subject);
            formData.append('sessionId', sessionId);
			if (customPrompt && customPrompt.trim() !== '') {
			    formData.append('customPrompt', customPrompt);
			}
            console.log('准备发送请求 - 科目:', subject, '会话ID:', sessionId);
            // 创建消息容器
            const messageContainer = createMessageElement('assistant', '');
            elements.chatMessages.appendChild(messageContainer);
            messageContainer.querySelector('.message-content').innerHTML = '<div class="typing-indicator">正在读取图片...</div>';
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
            const contentType = response.headers.get('content-type');
            if (!contentType || (!contentType.includes('text/event-stream') && !contentType.includes('application/json'))) {
                throw new Error('服务器返回了不支持的响应格式');
            }
            console.log('开始处理服务器响应');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';
            let lastRenderedContent = '';
            let renderTimer = null;
            let isMultiImage = files.length > 1;
            let done = false;
            // 工具函数：判断内容末尾是否为公式分隔符
            function endsWithMathDelimiter(str) {
                return /\\\)$|\\\]$|\$$|\$\$$/.test(str.trim());
            }
            // 渲染函数
            function tryRender() {
                if (fullContent && fullContent !== lastRenderedContent) {
                    try {
                        let mathExpressions = [];
                        let mathIndex = 0;
                        let contentWithPlaceholders = fullContent.replace(
                          /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([^)]+\\\)|\$[^$]*?\$/g,
                          (match) => {
                            mathExpressions.push(match);
                            return `@@MATH_EXPR_${mathIndex++}@@`;
                          }
                        );
                        let htmlContent = marked.parse(contentWithPlaceholders);
                        htmlContent = htmlContent.replace(/@@MATH_EXPR_(\d+)@@/g, (_, index) => mathExpressions[index]);
                        messageContainer.querySelector('.message-content').innerHTML = htmlContent;
                        if (window.MathJax && window.MathJax.typesetPromise) {
                            window.MathJax.typesetPromise([messageContainer.querySelector('.message-content')]);
                        }
                        lastRenderedContent = fullContent;
                    } catch (renderError) {
                        console.error('渲染内容时出错:', renderError);
                    }
                }
            }
            while (true) {
                const {value, done: streamDone} = await reader.read();
                if (streamDone) {
                    console.log('响应流读取完成');
                    break;
                }
                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    if (line.startsWith('data:')) {
                        try {
                            const data = line.slice(5).trim();
                            if (data === '[DONE]') {
                                console.log('收到[DONE]标记');
                                continue;
                            }
                            const eventData = JSON.parse(data);
                            if (eventData.error) {
                                updateSessionStatus(SessionStatus.ERROR, eventData);
                                break;
                            }
                            if (eventData.content) {
                                fullContent += eventData.content;
                                // === 修改判断逻辑 ===
                                if (subject === 'customs') {
                                    // customPrompt：内容长度变化且末尾不是公式分隔符时渲染
                                    if (fullContent.length !== lastRenderedContent.length && !endsWithMathDelimiter(fullContent)) {
                                        tryRender();
                                    }
                                } else if (subject === 'math') {
                                    // math：公式分隔符成对出现时渲染
                                    const openCount = (fullContent.match(/\\\(/g) || []).length;
                                    const closeCount = (fullContent.match(/\\\)/g) || []).length;
                                    if (openCount > 0 && openCount === closeCount) {
                                        tryRender();
                                    }
                                } else {
                                    // 其他：内容长度变化且末尾不是公式分隔符时渲染
                                    if (fullContent.length !== lastRenderedContent.length && !endsWithMathDelimiter(fullContent)) {
                                        tryRender();
                                    }
                                }
                                // === 结束 ===
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
            done = true;
            if (renderTimer) {
                clearInterval(renderTimer);
                renderTimer = null;
            }
            // 最终渲染
            console.log('准备渲染最终内容:', fullContent);
            tryRender();
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
            showSystemMessage('文件上传失败：' + error.message, 'error');
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
        
        // 设置普通作业上传和高级版作业上传事件监听
        const uploadOptions = {
            homework: document.querySelector('.upload-option[data-type="homework"]'),
            homeworkPro: document.querySelector('.upload-option[data-type="homework-pro"]')
        };
        
        // 处理普通作业上传
        if (uploadOptions.homework) {
            console.log('找到普通作业上传选项元素');
            const homeworkInput = document.createElement('input');
            homeworkInput.type = 'file';
            homeworkInput.multiple = true;
            homeworkInput.accept = 'image/*';
            homeworkInput.style.display = 'none';
            document.body.appendChild(homeworkInput);
            
            uploadOptions.homework.addEventListener('click', () => {
                console.log('普通作业上传选项被点击');
                hideUploadMenu();
                homeworkInput.click();
            });
            
            homeworkInput.addEventListener('change', (e) => {
                console.log('选择了普通作业文件:', e.target.files);
                handleHomeworkUpload(e.target.files);
                homeworkInput.value = ''; // 清空选择，允许重复选择相同文件
            });
        } else {
            console.warn('未找到普通作业上传选项元素');
        }

        // 处理高级版作业上传
        if (uploadOptions.homeworkPro) {
            console.log('找到高级版作业上传选项元素');
            const homeworkProInput = document.createElement('input');
            homeworkProInput.type = 'file';
            homeworkProInput.multiple = true;
            homeworkProInput.accept = 'image/*';
            homeworkProInput.style.display = 'none';
            document.body.appendChild(homeworkProInput);
            
            uploadOptions.homeworkPro.addEventListener('click', () => {
                console.log('高级版作业上传选项被点击');
                hideUploadMenu();
                homeworkProInput.click();
            });
            
            homeworkProInput.addEventListener('change', (e) => {
                console.log('选择了高级版作业文件:', e.target.files);
                handleHomeworkProUpload(e.target.files);
                homeworkProInput.value = ''; // 清空选择，允许重复选择相同文件
            });
        } else {
            console.warn('未找到高级版作业上传选项元素');
        }

        // 所有初始化完成后启用输入框，但保持发送按钮禁用状态（直到有输入）
        setInputState(true);
        elements.sendButton.disabled = true;
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
                const sessionId = getSessionIdFromUrl();
                if (!sessionId) {
                    console.error('无法获取会话ID');
                    showSystemMessage('无法获取会话ID，请确保您在有效的聊天会话中', 'error');
                    return;
                }
                
                console.log('当前会话ID:', sessionId);
                learningAnalytics.displayLearningReport(sessionId);
            } catch (error) {
                console.error('显示学习报告时出错:', error);
                showSystemMessage('显示学习报告时出错: ' + error.message, 'error');
            }
        });
        console.log('学习报告按钮事件监听器添加完成');
    } else {
        console.warn('未找到学习报告按钮元素');
    }

    // 在handleHomeworkUpload函数之后，initializeChat函数之前添加这些函数
    async function handleHomeworkProUpload(files) {
        try {
            // 添加防御性检查
            if (!files || typeof files !== 'object') {
                console.error('文件对象无效:', files);
                showSystemMessage('文件上传失败：无效的文件对象', 'error');
                return;
            }

            updateSessionStatus(SessionStatus.INITIALIZING);
            
            console.log('开始处理高级版作业上传（讯飞OCR），文件列表:', files);
            
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
            for (const file of filesList) {
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
                        document.body.removeChild(subjectDialog);
                        await uploadHomeworkPro(filesList, subject);
                    } catch (error) {
                        console.error('处理科目选择时出错:', error);
                        showSystemMessage(`处理失败: ${error.message}`, 'error');
                    }
                });
            });
        } catch (error) {
            console.error('处理高级版作业上传时出错:', error);
            updateSessionStatus(SessionStatus.ERROR, {
                message: error.message,
                errorType: 'UPLOAD_ERROR',
                errorDescription: '上传作业时发生错误'
            });
            showSystemMessage('文件上传失败：' + error.message, 'error');
        }
    }

    // 上传高级版作业并获取讯飞OCR识别结果
    async function uploadHomeworkPro(files, subject) {
        try {
            console.log('开始上传高级版作业（讯飞OCR） - 文件数量:', files.length, '科目:', subject);
            
            if (!files || !Array.isArray(files) || files.length === 0) {
                throw new Error('请选择要批改的作业文件');
            }
            
            if (!subject || subject.trim() === '') {
                throw new Error('请选择作业科目');
            }
            
            showSystemMessage('正在上传作业并进行OCR识别...', 'info');
            
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
                console.log('添加文件到表单:', file.name, file.size, 'bytes');
            });
            formData.append('subject', subject);
            formData.append('sessionId', sessionId);
            
            console.log('准备发送OCR请求 - 科目:', subject, '会话ID:', sessionId);
            
            // 创建消息容器
            const messageContainer = createMessageElement('assistant', '');
            elements.chatMessages.appendChild(messageContainer);
            messageContainer.querySelector('.message-content').innerHTML = '<div class="typing-indicator">正在使用讯飞OCR识别作业内容...</div>';
            
            // 发送请求到讯飞OCR API端点
            const response = await fetch('/homework/XFCheck', {
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
            
            console.log('开始处理OCR识别结果');
            
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

							    // 检查公式分隔符是否成对出现
							    const openCount = (fullContent.match(/\\\(/g) || []).length;
							    const closeCount = (fullContent.match(/\\\)/g) || []).length;

							    if (openCount > 0 && openCount === closeCount) {
							        try {
										// 1. 渲染前保护公式
										let mathExpressions = [];
										let mathIndex = 0;
										let contentWithPlaceholders = fullContent.replace(
										  /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\$\$[\s\S]*?\$\$|\\[[\s\S]*?\\]|\\\([^\)]*?\\\)|\$[^\$]*?\$/g,
										  (match) => {
										    mathExpressions.push(match);
										    return `@@MATH_EXPR_${mathIndex++}@@`;
										  }
										);
										//console.log('带占位符的内容:', contentWithPlaceholders);

										// 2. marked 渲染
										let htmlContent = marked.parse(contentWithPlaceholders);
										//console.log('marked 渲染后:', htmlContent);

										// 3. 渲染后还原公式
										htmlContent = htmlContent.replace(/@@MATH_EXPR_(\d+)@@/g, (_, index) => {
										    // 直接返回原始公式字符串
										    return mathExpressions[index];
										});
										messageContainer.querySelector('.message-content').innerHTML = htmlContent;
										//console.log('最终 innerHTML:', messageContainer.querySelector('.message-content').innerHTML);
										
										if (window.MathJax && window.MathJax.typesetPromise) {
										    window.MathJax.typesetPromise([messageContainer.querySelector('.message-content')]);
                                    }
                                } catch (renderError) {
                                    console.error('渲染内容时出错:', renderError);
							        }
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
								const mathPattern = /\\\\\\([\\s\\S]+?\\\\\\)/g;
								let mathCount = (fullContent.match(mathPattern) || []).length;
								if (mathCount > 0) {
								    messageContainer.querySelector('.message-content').innerHTML = marked.parse(fullContent);
								    if (window.MathJax && window.MathJax.typesetPromise) {
								        window.MathJax.typesetPromise([messageContainer.querySelector('.message-content')]);
								    }
								}
                            }
                        } catch (e) {
                            console.error('处理剩余数据时出错:', e);
                        }
                    }
                }
            }
            
            // 最终渲染
            console.log('准备渲染最终内容:', fullContent);
			// 1. 保护公式
			const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^\$]+\$|\\\([^\)]+\\\)|\\\[[^\]]+\\\])/g;
			let mathMap = [];
			let protectedContent = fullContent.replace(mathRegex, (match) => {
			    const key = `%%MATH_PLACEHOLDER_${mathMap.length}%%`;
			    mathMap.push({ key, value: match });
			    return key;
			});
			//console.log('【保护公式后】', protectedContent, mathMap);
			// 2. marked渲染
			let finalRenderedContent = marked.parse(protectedContent);
			//console.log('【marked渲染后】', finalRenderedContent);

			// 3. 还原公式
			mathMap.forEach(({ key, value }) => {
			    // 替换原始占位符
			    finalRenderedContent = finalRenderedContent.replace(new RegExp(key, 'g'), value);
			    // 替换被加粗的占位符
			    const strongKey = `<strong>${key.replace(/%/g, '')}</strong>`;
			    finalRenderedContent = finalRenderedContent.replace(new RegExp(strongKey, 'g'), value);
			});
			//console.log('【还原公式后】', finalRenderedContent);
			// 4. 插入HTML
                messageContainer.querySelector('.message-content').innerHTML = finalRenderedContent;
                
			// 5. 数学公式渲染
                if (typeof renderMathInElement === 'function') {
                    renderMathInElement(messageContainer.querySelector('.message-content'), {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false},
                            {left: '\\(', right: '\\)', display: false},
			            {left: '\\[', right: '\\]', display: false}
                        ],
                        throwOnError: false
                    });
                }
			if (window.MathJax && window.MathJax.typesetPromise) {
			    MathJax.typesetPromise([messageContainer.querySelector('.message-content')]);
            }
        } catch (error) {
            console.error('上传高级版作业时出错:', error);
            updateSessionStatus(SessionStatus.ERROR, {
                message: error.message,
                errorType: 'UPLOAD_ERROR',
                errorDescription: '上传作业时发生错误'
            });
            showSystemMessage('文件上传失败：' + error.message, 'error');
            throw error;
        }
    }

    // 停止按钮事件监听
    elements.stopButton = document.getElementById('stop-button');
    if (elements.stopButton) {
        elements.stopButton.addEventListener('click', function() {
            if (streamAbortController) {
                streamAbortController.abort();
                // 发送停止指令到后端
                fetch('/chat/stop', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ sessionId: sessionId })
                });
            }
            elements.stopButton.style.display = 'none';
            setInputState(true);
        });
    }

    // 新增：发送按钮点击事件监听
    if (elements.sendButton) {
        elements.sendButton.addEventListener('click', function(event) {
            // 直接调用原有的handleSubmit逻辑，但不需要event.preventDefault()
            handleSendButtonClick();
        });
    }

    // 新增：将handleSubmit逻辑迁移为handleSendButtonClick
    function handleSendButtonClick() {
        const question = elements.messageInput.value.trim();
        // 检查消息是否为空
        if (!question) {
            // 消息为空，不提交
            console.log('消息为空，不提交');
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }
            return;
        }
        // 立即清空并重置输入框
        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';
        elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
        setInputState(false);
        try {
            askQuestionStreamPost(question);
        } catch (error) {
            console.error('发送消息时出错:', error);
            showSystemMessage('发送消息失败，请重试', 'error');
            setInputState(true);
        }
    }

});

// 数学公式渲染函数
function renderMathInElement(element, options) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([element]).catch((err) => {
            console.error('MathJax渲染错误:', err);
        });
    }
}

// 联网状态logo切换逻辑
(function() {
    function updateNetworkLogo() {
        console.log('更新联网状态logo');
        var logoDiv = document.getElementById('network-status-logo');
        if (!logoDiv) return;
        if (navigator.onLine) {
            // 绿色联网logo
            logoDiv.innerHTML = '<svg width="32" height="32"><circle cx="16" cy="16" r="14" fill="#4CAF50"/><text x="16" y="22" text-anchor="middle" fill="#fff" font-size="16" font-family="Arial" dy="0">网</text></svg>';
            logoDiv.title = '当前已联网';
        } else {
            // 灰色离线logo
            logoDiv.innerHTML = '<svg width="32" height="32"><circle cx="16" cy="16" r="14" fill="#BDBDBD"/><text x="16" y="22" text-anchor="middle" fill="#fff" font-size="16" font-family="Arial" dy="0">网</text></svg>';
            logoDiv.title = '当前离线';
        }
    }
    window.addEventListener('online', updateNetworkLogo);
    window.addEventListener('offline', updateNetworkLogo);
    document.addEventListener('DOMContentLoaded', updateNetworkLogo);
    // 若页面已加载也要初始化
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        updateNetworkLogo();
    }
})();


// 联网搜索按钮状态管理
var searchOptions = false;
function updateSearchOnlineBtnStyle() {
    var btn = document.getElementById('search-online-btn');
    if (!btn) return;
    if (searchOptions) {
        btn.style.background = '#4CAF50'; // 绿色
        btn.style.color = '#fff';
        btn.querySelector('svg').style.stroke = '#fff';
        btn.querySelector('span').style.color = '#fff';
    } else {
        btn.style.background = '#f5f5f5'; // 灰色
        btn.style.color = '#444';
        btn.querySelector('svg').style.stroke = '#444';
        btn.querySelector('span').style.color = '#444';
    }
}
document.addEventListener('DOMContentLoaded', function() {
    var searchOnlineBtn = document.getElementById('search-online-btn');
    if (searchOnlineBtn) {
        // 初始化为灰色
        searchOptions = false;
        updateSearchOnlineBtnStyle();
        searchOnlineBtn.addEventListener('click', function() {
            searchOptions = !searchOptions;
            updateSearchOnlineBtnStyle();
            // 不要在这里发送消息或调用fetch
            // 也不要alert或console.log（除非调试用）
        });
    }
});
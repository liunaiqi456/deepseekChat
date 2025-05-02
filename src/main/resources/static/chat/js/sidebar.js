document.addEventListener("DOMContentLoaded", () => {
    const newChatButton = document.getElementById("new-chat-button");
    const historyList = document.querySelector(".history-nav ul");
    let chatCounter = 1; // 初始化对话计数器

    // 监听“新建对话”按钮点击事件
    newChatButton.addEventListener("click", () => {
        chatCounter++;
        const sessionId = `s-${chatCounter}`;
        addChatToHistory(`对话 ${chatCounter}`, sessionId);
        window.location.href = `/chat/s/${sessionId}`; // 跳转到新页面
    });

    // 添加对话到历史列表
    function addChatToHistory(chatName, sessionId) {
        const chatItem = document.createElement("li");
        chatItem.className = "chat-item";

        const chatLink = document.createElement("a");
        chatLink.href = `/chat/s/${sessionId}`;
        chatLink.className = "chat-link";
        chatLink.textContent = chatName;

        chatItem.appendChild(chatLink);
        historyList.appendChild(chatItem);
    }
});

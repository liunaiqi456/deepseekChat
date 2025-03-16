<template>
  <div class="chat-input">
    <input v-model="text" @keyup.enter="send" placeholder="输入消息..." />
    <button @click="send">发送</button>
  </div>
</template>

<script setup>
import { ref } from "vue";
const text = ref("");

const emit = defineEmits(["sendMessage"]);
const send = () => {
  if (text.value.trim()) {
    emit("sendMessage", text.value);
    text.value = "";
  }
};
</script>

<style>
.chat-input {
  display: flex;
  padding: 10px;
  background: #fff;
}
input {
  flex: 1;
  padding: 5px;
}
button {
  margin-left: 10px;
}
</style>
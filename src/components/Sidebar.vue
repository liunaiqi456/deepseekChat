<template>
  <div class="sidebar">
    <h2>DeepSeek</h2>
    <button @click="newChat">➕ 开启新对话</button>
    <ul>
      <li v-for="(chat, index) in chats" :key="index">{{ chat }}</li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from "vue";

const chats = ref(["最近对话1", "最近对话2"]);
const newChat = () => {
  chats.value.unshift("新对话 " + (chats.value.length + 1));
};
</script>

<style>
.sidebar {
  width: 250px;
  padding: 20px;
  background: #f5f5f5;
}
</style>
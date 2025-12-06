import { GoogleGenerativeAI } from "@google/generative-ai";
import md from "markdown-it";
import hljs from "highlight.js";

// Initialize markdown parser with highlight.js integration
const markdown = md({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs p-4 rounded-md text-sm my-2"><code>${
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
        }</code></pre>`;
      } catch (__) {}
    }
    return `<pre class="hljs p-4 rounded-md text-sm my-2"><code>${markdown.utils.escapeHtml(str)}</code></pre>`;
  },
});

// Configuration
const API_KEY = import.meta.env.VITE_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

// ADDED: System instructions so the AI behaves as DataVoid AI
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  systemInstruction: "You are DataVoid AI, a helpful and intelligent assistant developed by the DataVoid Team. You are NOT Google Gemini. If asked about your creators, answer 'The DataVoid Team'. Your goal is to provide accurate, helpful, and secure assistance."
});

let history = [];
let isProcessing = false;

// DOM Elements
const chatContainer = document.getElementById("chat-container");
const chatForm = document.getElementById("chat-form");
const promptInput = document.getElementById("prompt");
const welcomeMessage = document.getElementById("welcome-message");
const clearBtn = document.getElementById("clear-btn");

// Helper: Scroll to bottom
const scrollToBottom = () => {
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: "smooth",
  });
};

// Component: User Message
const userDiv = (text) => `
  <div class="flex justify-end mb-6 animate-fade-in">
    <div class="bg-accent text-white max-w-[85%] rounded-2xl rounded-tr-sm px-5 py-3 shadow-md">
      <div class="prose prose-invert prose-sm max-w-none leading-relaxed whitespace-pre-wrap font-sans">${markdown.utils.escapeHtml(text)}</div>
    </div>
  </div>
`;

// Component: AI Message
const aiDiv = (htmlContent) => `
  <div class="flex justify-start mb-6 animate-fade-in w-full">
    <div class="flex gap-3 max-w-[90%] md:max-w-[85%]">
      <img src="/chat-bot.jpg" alt="AI" class="w-8 h-8 rounded-lg object-cover border border-[#333333] flex-shrink-0">
      
      <div class="text-[#e0e0e0] rounded-2xl rounded-tl-sm px-1 py-1">
        <div class="prose prose-invert prose-p:leading-relaxed prose-pre:bg-[#121212] prose-pre:border prose-pre:border-[#333333] max-w-none font-sans">
          ${htmlContent}
        </div>
      </div>
    </div>
  </div>
`;

// Component: Loading Indicator
const loadingDiv = () => `
  <div id="loading-indicator" class="flex justify-start mb-6 animate-fade-in">
    <div class="flex gap-3">
       <img src="/chat-bot.jpg" alt="AI" class="w-8 h-8 rounded-lg object-cover border border-[#333333] flex-shrink-0">
      <div class="bg-[#252525] h-10 px-4 rounded-full flex items-center gap-1.5 border border-[#333333]">
        <span class="w-2 h-2 bg-accent rounded-full typing-dot"></span>
        <span class="w-2 h-2 bg-accent rounded-full typing-dot"></span>
        <span class="w-2 h-2 bg-accent rounded-full typing-dot"></span>
      </div>
    </div>
  </div>
`;

// Function to handle chat logic
async function handleChat(userText) {
  if (isProcessing || !userText.trim()) return;
  isProcessing = true;

  // UI Updates
  if (welcomeMessage) welcomeMessage.style.display = 'none';
  promptInput.value = "";
  promptInput.style.height = "auto";
  
  // Add User Message
  chatContainer.insertAdjacentHTML('beforeend', userDiv(userText));
  scrollToBottom();

  // Add Loading
  chatContainer.insertAdjacentHTML('beforeend', loadingDiv());
  scrollToBottom();

  try {
    const chat = model.startChat({ history: history });
    const result = await chat.sendMessage(userText);
    const response = await result.response;
    const text = response.text();

    // Update History
    history.push(
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: text }] }
    );

    // Remove Loading and Add Response
    document.getElementById("loading-indicator").remove();
    const renderedResponse = markdown.render(text);
    chatContainer.insertAdjacentHTML('beforeend', aiDiv(renderedResponse));
    
  } catch (error) {
    console.error(error);
    const loader = document.getElementById("loading-indicator");
    if(loader) loader.remove();
    chatContainer.insertAdjacentHTML('beforeend', aiDiv(`<span class="text-red-400">Error: ${error.message}. Please try again.</span>`));
  }

  scrollToBottom();
  isProcessing = false;
  promptInput.focus();
}

// Event Listeners
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleChat(promptInput.value);
});

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleChat(promptInput.value);
  }
});

promptInput.addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = (this.scrollHeight) + "px";
  if(this.value === '') this.style.height = 'auto';
});

clearBtn.addEventListener("click", () => {
  if(confirm("Start a new session?")) {
    history = [];
    location.reload();
  }
});
import { GoogleGenerativeAI } from "@google/generative-ai";
import md from "markdown-it";

// Initialize the model
const genAI = new GoogleGenerativeAI(`${import.meta.env.VITE_API_KEY}`);

const model = genAI.getGenerativeModel({ model: "gemini-pro" });

let history = [];

const showLoading = () => {
  const chatArea = document.getElementById("chat-container");
  chatArea.innerHTML += `<div class="bg-gray-200 p-1 rounded-md shadow-md text-center procd">Processing...</div>`;
}; //added

async function getResponse(prompt) {

   showLoading(); //added

  const chat = await model.startChat({ history: history });
  const result = await chat.sendMessage(prompt);
  const response = await result.response;
  const text = response.text();

  const chatArea = document.getElementById("chat-container");
  const loadingMessage = chatArea.querySelector(".bg-gray-200");
  if (loadingMessage) {
    loadingMessage.remove();
  } //added

  console.log(text);
  return text;
}

// user chat div
export const userDiv = (data) => {
  return `
  <!-- User Chat -->
          <div class="flex items-center gap-2 justify-start">
            <img
              src="user.jpg"
              alt="user icon"
              class="w-10 h-10 rounded-full"
            />
            <p class="bg-gemDeep text-white p-1 rounded-md shadow-md  ">
              ${data}
            </p>
          </div>
  `;
};

// AI Chat div
export const aiDiv = (data) => {
  return `
  <!-- AI Chat -->
          <div class="gap-2 justify-end">
            <pre class="bg-gemRegular/40 text-gemDeep p-1 rounded-md shadow-md whitespace-pre-wrap">
              ${data}
            </pre>
            <img
              src="chat-bot.jpg"
              alt="user icon"
              class="w-10 h-10 rounded-full"
              style="float: right;"
            />
          </div>
  `;
};

async function handleSubmit(event) {
  event.preventDefault();
   //showLoading(); //added
  let userMessage = document.getElementById("prompt");
  const chatArea = document.getElementById("chat-container");

  var prompt = userMessage.value.trim();
  if (prompt === "") {
    return;
  }

  console.log("user message", prompt);

  chatArea.innerHTML += userDiv(prompt);
  userMessage.value = "";
  const aiResponse = await getResponse(prompt);
  let md_text = md().render(aiResponse);
  chatArea.innerHTML += aiDiv(md_text);

  let newUserRole = {
    role: "user",
    parts: prompt,
  };
  let newAIRole = {
    role: "model",
    parts: aiResponse,
  };

  history.push(newUserRole);
  history.push(newAIRole);

  console.log(history);
}

const chatForm = document.getElementById("chat-form");
chatForm.addEventListener("submit", handleSubmit);

chatForm.addEventListener("keyup", (event) => {
  if (event.keyCode === 13) handleSubmit(event);
});

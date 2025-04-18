import { UserMessage } from "../components/ChatBot";
import { v4 as uuidv4 } from "uuid";
import { ApiResponsePayload, sendApiResponse } from "./apiBackend";

export type SendMessageToOpenAIParams = {
  apiKey: string;
  organizationId: string;
  projectId: string;
  modelName: string;
  systemPrompt: string;
  userMessage: string;
  previousMessages: UserMessage[];
  fileContent: string | ArrayBuffer | null;
  fileName: string | null;
  temperature: number;
  useContext: boolean;
  apiMaxOutputTokens: number;
  APIStoreResponseDataEndpoint: string;
  APIAccessToken: string;
  APIHttpMethod?: "POST" | "GET" | "PUT";
  approach?: Array<{ agent: string; user: string }>;
  goodFormatting?: boolean;
  tone?: string;
  useEmoji?: boolean;
};

interface OpenAIApiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
      refusal: string | null;
      annotations: any[];
    };
    logprobs: any | null;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details: {
      cached_tokens: number;
      audio_tokens: number;
    };
    completion_tokens_details: {
      reasoning_tokens: number;
      audio_tokens: number;
      accepted_prediction_tokens: number;
      rejected_prediction_tokens: number;
    };
  };
  service_tier: string;
}

interface Message {
  role: "system" | "developer" | "user" | "assistant";
  content: string;
}
export async function sendMessageToModel({
  apiKey,
  organizationId,
  projectId,
  modelName,
  systemPrompt,
  userMessage,
  previousMessages,
  fileContent = null,
  fileName = null,
  temperature,
  useContext,
  apiMaxOutputTokens,
  APIStoreResponseDataEndpoint,
  APIAccessToken,
  APIHttpMethod,
  approach,
  goodFormatting,
  tone,
  useEmoji,
}: SendMessageToOpenAIParams) {
  const apiUrl = `https://api.openai.com/v1/chat/completions`;
  // adding prompt
  let enhancedSystemPrompt = "";
  if (goodFormatting) {
    enhancedSystemPrompt +=
      "Please format your responses with clear structure, using paragraphs, bullet points, and headings when appropriate to make the content easily readable and well-organized. Use proper spacing, line breaks etc to make it more readable. Try to make it concise and to the point if possible.\n\n";
  }
  enhancedSystemPrompt += `Please respond in a ${tone} tone of voice.\n\n`;
  if (useEmoji) {
    enhancedSystemPrompt +=
      "Please include appropriate emojis in your responses to make them more engaging😊🎉.\n\n";
  }
  let finalSystemPrompt = enhancedSystemPrompt + (systemPrompt || "");

  let formattedMessages: Message[] = [];
  if (approach) {
    approach.forEach((pair) => {
      formattedMessages.push({
        role: "user",
        content: pair.user,
      });
      formattedMessages.push({
        role: "assistant",
        content: pair.agent,
      });
    });
  }
  let userMessageText = userMessage;
  if (fileContent) {
    userMessageText += `\n\nFile Content (${fileName}): ${fileContent}`;
  }

  formattedMessages.push({
    role: "system",
    content: finalSystemPrompt,
  });
  formattedMessages.push({
    role: "user",
    content: userMessageText,
  });

  if (useContext) {
    for (let i = 0; i < previousMessages.length; i++) {
      const msg = previousMessages[i];
      if (msg.type === "text") {
        formattedMessages.push({
          role: msg.isUser ? "user" : "assistant",
          content: msg.text,
        });
      }
    }
  }

  const requestBody = {
    max_completion_tokens: apiMaxOutputTokens,
    temperature: temperature,
    model: modelName,
    messages: formattedMessages,
  };

  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  headers.append("Authorization", `Bearer ${apiKey}`);
  if (organizationId.length > 0) {
    headers.append("OpenAI-Organization", `${organizationId}`);
  }
  if (projectId.length > 0) {
    headers.append("OpenAI-Project", `${projectId}`);
  }

  const response = await fetch(`${apiUrl}`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      errorData.error?.message || "Failed to get response from Model",
    );
  }

  const data: OpenAIApiResponse = await response.json();
  // Sample Output

  let uuid = localStorage.getItem("userUUID");
  if (!uuid) {
    uuid = uuidv4();
    localStorage.setItem("userUUID", uuid);
  }

  if (APIStoreResponseDataEndpoint && APIStoreResponseDataEndpoint !== "") {
    const apiPayload: ApiResponsePayload = {
      userUUID: uuid,
      userMessage: userMessageText,
      modelMessage: data.choices[0].message.content,
    };

    try {
      await sendApiResponse(
        APIStoreResponseDataEndpoint,
        APIAccessToken,
        apiPayload,
        APIHttpMethod || "POST",
      );
    } catch (error) {
      console.error("Failed to store response data:", error);
    }
  }
  if (
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
  ) {
    return data;
  } else {
    throw new Error("Unexpected response format from Model API");
  }
}

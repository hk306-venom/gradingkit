import { useMemo } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import type { ChatKitOptions } from "@openai/chatkit";
import { createClientSecretFetcher, workflowId } from "../lib/chatkitSession";

export function ChatKitPanel() {
  const getClientSecret = useMemo(
    () => createClientSecretFetcher(workflowId),
    []
  );

  const options: ChatKitOptions = {
    api: {
      getClientSecret,
    },
    theme: {
      colorScheme: 'dark',
      radius: 'pill',
      density: 'compact',
      color: {
        grayscale: {
          hue: 0,
          tint: 0
        },
        accent: {
          primary: '#233a48',
          level: 1
        },
        surface: {
          background: '#102b2d',
          foreground: '#0e2025'
        }
      },
      typography: {
        baseSize: 16,
        fontFamily: '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        fontFamilyMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
        fontSources: [
          {
            family: 'OpenAI Sans',
            src: 'https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2',
            weight: 400,
            style: 'normal',
            display: 'swap'
          }
        ]
      },
    },
    composer: {
      placeholder: 'Just click and grade in seconds',
      attachments: {
        enabled: true,
        maxCount: 5,
        maxSize: 10485760,
      },
      tools: [
        {
          id: 'search_docs',
          label: 'Search docs',
          shortLabel: 'Docs',
          placeholderOverride: 'Search documentation',
          icon: 'book-open',
          pinned: true,
        },
      ],
      models: [
        {
          id: 'gpt-5',
          label: 'gpt-5',
          description: 'Balanced intelligence',
          default: true,
        },
      ],
    },
    startScreen: {
      greeting: 'Grade Smarter, Grade Faster',
      prompts: [],
    },
  };

  const chatkit = useChatKit(options);

  return (
    <div className="flex h-[90vh] w-full">
      <ChatKit control={chatkit.control} className="h-full w-full" />
    </div>
  );
}
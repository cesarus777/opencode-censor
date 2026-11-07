// Controlled loopback OpenAI-compatible provider. Synthetic input only.
export function localProvider() {
  let mode = "allow";
  const records: Record<string, unknown>[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as {
        model: string;
        stream?: boolean;
        messages: { role: string; content?: unknown }[];
      };
      const reviewing = body.model === "reviewer";
      const selected = mode;
      if (reviewing) {
        records.push({ type: "review-start", mode: selected });
        request.signal.addEventListener(
          "abort",
          () => records.push({ type: "provider-abort", mode: selected }),
          { once: true },
        );
        if (selected === "slow") await Bun.sleep(1500);
        if (selected === "error")
          return Response.json(
            {
              error: {
                message: "Controlled failure",
                type: "invalid_request_error",
              },
            },
            { status: 400 },
          );
        records.push({
          type: "review-end",
          mode: selected,
          aborted: request.signal.aborted,
        });
      }
      const lastUser = JSON.stringify(
        body.messages.filter((message) => message.role === "user").at(-1)
          ?.content,
      );
      const finished = body.messages.some((message) => message.role === "tool");
      const command = lastUser?.includes("probe-generic")
        ? "ninja"
        : lastUser?.includes("probe-deny")
          ? "git push --force"
          : lastUser?.includes("probe-policy")
            ? "printf censor-smoke"
            : "pwd";
      const textContent = (value: unknown): string => {
        if (typeof value === "string") return value;
        if (Array.isArray(value)) return value.map(textContent).join("\n");
        if (
          value &&
          typeof value === "object" &&
          "text" in value &&
          typeof value.text === "string"
        )
          return value.text;
        return "";
      };
      const readEvidence = body.messages
        .map((message) => textContent(message.content))
        .join("\n")
        .includes('"content":');
      if (reviewing && selected.startsWith("project"))
        records.push({ type: "project-evidence", read: readEvidence });
      const content = reviewing
        ? selected.startsWith("project")
          ? JSON.stringify(
              readEvidence ||
                (selected === "project-missing" &&
                  body.messages
                    .map((message) => textContent(message.content))
                    .join("\n")
                    .includes('"status":"unavailable"'))
                ? {
                    action: "decide",
                    decision: selected === "project" ? "allow" : "ask",
                    riskLevel: selected === "project" ? "low" : "medium",
                    reasonCode:
                      selected === "project"
                        ? "understood_operation"
                        : "incomplete_evidence",
                    confidence: 0.99,
                    uncertain: selected !== "project",
                    evidence: [selected === "project-missing" ? "e1" : "e2"],
                    effects: ["workspace_read", "process_execution"],
                  }
                : {
                    action: "read",
                    path:
                      selected === "project-missing"
                        ? "missing.ninja"
                        : "build.ninja",
                  },
            )
          : selected === "ask"
            ? '{"decision":"ask","riskLevel":"medium","reason":"Controlled uncertainty."}'
            : '{"decision":"allow","riskLevel":"low","reason":"Read-only inspection."}'
        : "Probe complete.";
      const tool = {
        id: "call_" + crypto.randomUUID(),
        type: "function",
        function: {
          name: "shell",
          arguments: JSON.stringify({
            command,
            description: "Inert native smoke",
          }),
        },
      };
      const finish = reviewing || finished ? "stop" : "tool_calls";
      const common = { id: "smoke", created: 1, model: body.model };
      if (!body.stream)
        return Response.json({
          ...common,
          object: "chat.completion",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content,
                ...(!reviewing && !finished ? { tool_calls: [tool] } : {}),
              },
              finish_reason: finish,
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      const chunks = [
        {
          ...common,
          object: "chat.completion.chunk",
          choices: [
            {
              index: 0,
              delta:
                reviewing || finished
                  ? { role: "assistant", content }
                  : { role: "assistant", tool_calls: [{ index: 0, ...tool }] },
              finish_reason: null,
            },
          ],
        },
        {
          ...common,
          object: "chat.completion.chunk",
          choices: [{ index: 0, delta: {}, finish_reason: finish }],
        },
      ];
      return new Response(
        chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") +
          "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } },
      );
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}/v1`,
    records,
    setMode(value: string) {
      mode = value;
    },
    stop() {
      server.stop(true);
    },
  };
}

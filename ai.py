import os
from typing import Optional


def _build_local_fallback(command: str, rules: str = "") -> str:
    cleaned = (command or "").strip()
    if not cleaned:
        return "TitanAI is ready. Provide a task or command to continue."

    summary = cleaned[:140].strip()
    lower = summary.lower()

    if any(word in lower for word in ["scan", "review", "qa", "plan", "memory", "architecture", "run", "edit", "create"]):
        return (
            "TitanAI offline mode engaged. "
            f"I can help with: {summary}. "
            "Use built-in commands like scan, architecture, plan, qa, memory, review, or run."
        )

    return (
        "TitanAI local fallback response. "
        f"No live OpenAI client is configured, so I’m responding locally for: {summary}. "
        "You can still use scan, architecture, plan, qa, memory, and roadmap commands."
    )


def ask(command: str, rules: str = "", client=None) -> str:
    if not client:
        return _build_local_fallback(command, rules)

    try:
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-5.5"),
            messages=[
                {"role": "system", "content": rules},
                {"role": "user", "content": command},
            ],
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        return f"Live request failed: {exc}. Falling back to local TitanAI behavior."


def build_engineering_plan(task: str) -> str:
    task_text = task.strip() or "inspect the current project"
    return (
        "Plan\n"
        "1. Clarify scope and success criteria for the task.\n"
        "2. Inspect the relevant files, dependencies, and recent changes.\n"
        "3. Make the smallest safe implementation change.\n"
        "4. Verify with tests, compilation, or runtime checks.\n"
        "5. Summarize risks, follow-up work, and evidence.\n\n"
        f"Task: {task_text}\n"
        "Verification: run targeted checks and capture concrete output."
    )


def build_workflow_summary() -> str:
    return (
        "Offline engineering workflow:\n"
        "- Scan the project and record findings into reports.\n"
        "- Keep working memory in JSON so context survives across sessions.\n"
        "- Run QA, architecture review, planning, and risk checks locally.\n"
        "- Edit files, create files, and run commands from the workspace.\n"
        "- Verify every change with concrete checks before reporting success."
    )

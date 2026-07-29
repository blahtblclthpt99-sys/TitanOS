def evaluate_risk(task: str) -> str:
    task_text = task.strip().lower()
    risk_score = "LOW"
    confidence = "95%"
    if any(term in task_text for term in ["deploy", "production", "database", "migration"]):
        risk_score = "MEDIUM"
        confidence = "90%"
    if any(term in task_text for term in ["security", "auth", "payments", "billing"]):
        risk_score = "HIGH"
        confidence = "88%"
    lines = ["Risk Assessment", "", f"Task: {task}", "", "Score", risk_score, "", "Confidence", confidence, "", "Recommended Action", "Proceed with targeted verification and rollback planning." ]
    return "\n".join(lines)

function failureMessage(error) {
  return String(error?.message || "Workflow step failed.").slice(0, 300);
}

/**
 * Execute a bounded multi-step workflow with compensation semantics.
 * Every successful step must return a rollback descriptor. If a later step
 * fails, completed steps are rolled back in reverse order before the error is
 * surfaced. This is application-level atomicity for independent Supabase writes.
 */
export async function executeCompensatingWorkflow({ steps, executeStep, rollbackStep }) {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 10) {
    const err = new Error("Workflow steps are invalid.");
    err.status = 400;
    throw err;
  }
  if (typeof executeStep !== "function" || typeof rollbackStep !== "function") {
    const err = new Error("Workflow executor is not configured.");
    err.status = 500;
    throw err;
  }

  const completed = [];
  try {
    for (let index = 0; index < steps.length; index += 1) {
      const result = await executeStep(steps[index], index);
      if (!result?.rollback) {
        const err = new Error(`Workflow step ${index + 1} did not provide a rollback action.`);
        err.status = 500;
        throw err;
      }
      completed.push({ index, result });
    }
    return completed.map(({ result }) => result);
  } catch (cause) {
    const rollbackFailures = [];
    for (const completedStep of [...completed].reverse()) {
      try {
        await rollbackStep(completedStep.result.rollback, completedStep.index);
      } catch (rollbackError) {
        rollbackFailures.push({
          step: completedStep.index + 1,
          message: failureMessage(rollbackError),
        });
      }
    }

    const compensated = rollbackFailures.length === 0;
    const err = new Error(
      compensated
        ? `Workflow failed and ${completed.length} completed step(s) were rolled back safely. ${failureMessage(cause)}`
        : `Workflow failed. Compensation was incomplete for ${rollbackFailures.length} step(s); manual review is required.`
    );
    err.status = compensated && (cause?.status === 400 || cause?.status === 403) ? cause.status : 500;
    err.cause = cause;
    err.compensated = compensated;
    err.completedSteps = completed.length;
    err.rollbackFailures = rollbackFailures;
    throw err;
  }
}

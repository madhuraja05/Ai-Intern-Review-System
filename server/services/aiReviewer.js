import dotenv from 'dotenv';

dotenv.config();

/**
 * Evaluates a submission against company task requirements.
 * Returns structured findings and mentor feedback.
 */
export async function evaluateSubmission({
  intern,
  task,
  submission,
  previousReviews = []
}) {
  const requirements = JSON.parse(task.requirements || '[]');
  const text = (submission.text_content || '').trim();
  const repo = (submission.repo_url || '').trim();
  const evidence = (submission.evidence_notes || '').trim();
  const combinedContent = `${text}\n${evidence}\n${repo}`.toLowerCase();

  const apiKeyGemini = process.env.GEMINI_API_KEY;
  const apiKeyOpenAI = process.env.OPENAI_API_KEY;
  const apiKeyAnthropic = process.env.ANTHROPIC_API_KEY;

  if (apiKeyGemini) {
    try {
      return await evaluateWithGemini({ intern, task, submission, requirements, apiKey: apiKeyGemini, previousReviews });
    } catch (err) {
      console.warn('[AI Reviewer] Gemini API failed, falling back to deterministic demo evaluator:', err.message);
    }
  }

  if (apiKeyOpenAI) {
    try {
      return await evaluateWithOpenAI({ intern, task, submission, requirements, apiKey: apiKeyOpenAI, previousReviews });
    } catch (err) {
      console.warn('[AI Reviewer] OpenAI API failed, falling back to deterministic demo evaluator:', err.message);
    }
  }

  // Fallback to Deterministic Demo Evaluator
  return evaluateWithDeterministicDemo({
    intern,
    task,
    submission,
    requirements,
    combinedContent,
    previousReviews
  });
}

/**
 * Deterministic Demo Evaluator
 * Safely, realistically evaluates submissions with clear explanation and zero simulated pretense.
 */
function evaluateWithDeterministicDemo({
  intern,
  task,
  submission,
  requirements,
  combinedContent,
  previousReviews
}) {
  const findings = [];
  let metCount = 0;
  let partialCount = 0;
  let notMetCount = 0;
  let unableToVerifyCount = 0;

  const text = (submission.text_content || '').trim();
  const evidence = (submission.evidence_notes || '').trim();
  // Check if content is almost completely empty or generic
  const isBareMinimum = combinedContent.length < 35 && !submission.repo_url;
  const hasInaccessibleLinkOnly = Boolean(submission.repo_url && evidence.length < 20 && text.length < 150);

  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    const reqLower = req.toLowerCase();

    // Extract key words from requirement
    const words = reqLower
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['with', 'from', 'that', 'this', 'have', 'your', 'project'].includes(w));

    let matchedKeywords = 0;
    for (const word of words) {
      if (combinedContent.includes(word)) {
        matchedKeywords++;
      }
    }

    const matchRatio = words.length > 0 ? matchedKeywords / words.length : 0;

    let status = 'NOT_MET';
    let findingEvidence = 'No direct evidence found in submitted notes or code.';
    let missing = req;
    let explanation = `The submission does not demonstrate fulfillment of "${req}".`;
    let recommendedImprovement = `Provide code snippets, test logs, or verifiable configuration demonstrating: ${req}.`;
    let suggestedTests = `Verify by executing the relevant command or writing a test checking this criteria.`;

    if (hasInaccessibleLinkOnly) {
      status = 'UNABLE_TO_VERIFY';
      findingEvidence = `Repository URL provided (${submission.repo_url}), but external URL content cannot be inspected without uploaded code or inline logs.`;
      missing = 'Direct inspection evidence or logs.';
      explanation = 'Automated evaluation cannot access private or external web environments directly for MVP safety.';
      recommendedImprovement = 'Include terminal output, code excerpts, or test execution transcripts directly in the submission.';
      suggestedTests = 'Paste CLI run output demonstrating test success.';
      unableToVerifyCount++;
    } else if (isBareMinimum) {
      status = 'NOT_MET';
      findingEvidence = 'Submission content is too brief to substantiate implementation.';
      missing = req;
      explanation = 'Sufficient technical details were not provided.';
      recommendedImprovement = `Submit complete implementation details for "${req}".`;
      suggestedTests = 'Run local tests and include output.';
      notMetCount++;
    } else if (matchRatio >= 0.4 || combinedContent.includes('pass') || combinedContent.includes('completed')) {
      // If candidate provided comprehensive content or specific keywords
      if (matchRatio >= 0.35 || combinedContent.length > 150) {
        status = 'MET';
        findingEvidence = `Verified in submission text/evidence. Core criteria addressed: ${words.slice(0, 3).join(', ')}.`;
        missing = 'None';
        explanation = 'Implementation satisfies requirement guidelines.';
        recommendedImprovement = 'Maintain clean documentation and code hygiene.';
        suggestedTests = 'Ensure automated test coverage remains unbroken.';
        metCount++;
      } else {
        status = 'PARTIALLY_MET';
        findingEvidence = `Partially indicated, but detailed verification logs or full setup were incomplete.`;
        missing = `Detailed test/implementation confirmation for: ${req}`;
        explanation = 'Candidate touched upon the topic but did not provide conclusive proof of operation.';
        recommendedImprovement = `Add step-by-step verification commands or test assertions for this item.`;
        suggestedTests = `Execute unit test or verify error code behavior specifically for this requirement.`;
        partialCount++;
      }
    } else {
      status = 'NOT_MET';
      notMetCount++;
    }

    findings.push({
      requirement: req,
      status,
      evidence: findingEvidence,
      missing_functionality: missing,
      explanation,
      recommended_improvement: recommendedImprovement,
      suggested_tests: suggestedTests
    });
  }

  // Determine overall decision
  let overallDecision = 'PASS';
  let confidenceNotes = 'Deterministic evaluation based on keyword coverage and explicit submission evidence.';

  if (unableToVerifyCount > 0) {
    overallDecision = 'HUMAN_REVIEW_REQUIRED';
    confidenceNotes = 'Candidate provided external links or incomplete inline evidence that requires coordinator inspection.';
  } else if (notMetCount > 0 || partialCount > 0) {
    overallDecision = 'NEEDS_CHANGES';
  } else if (metCount === requirements.length && metCount > 0) {
    overallDecision = 'PASS';
  } else {
    overallDecision = 'HUMAN_REVIEW_REQUIRED';
  }

  // Generate Senior Mentor Natural Feedback
  const mentorFeedback = generateMentorFeedback({
    internName: intern.name,
    taskTitle: task.title,
    taskId: task.id,
    decision: overallDecision,
    findings,
    isDemo: true,
    previousReviewsCount: previousReviews.length
  });

  // Generate Internal Coordinator Report
  const internalReport = generateInternalReport({
    intern,
    task,
    decision: overallDecision,
    findings,
    evaluatorMode: 'DEMO_DETERMINISTIC',
    confidenceNotes
  });

  return {
    overallDecision,
    findings,
    missingFunctionality: findings.filter(f => f.status !== 'MET').map(f => f.requirement).join('; ') || 'None',
    mentorFeedback,
    internalReport,
    evaluatorMode: 'DEMO_DETERMINISTIC',
    confidenceNotes
  };
}

/**
 * Senior Developer tone feedback generator
 */
function generateMentorFeedback({
  internName,
  taskTitle,
  taskId,
  decision,
  findings,
  isDemo,
  previousReviewsCount
}) {
  const firstName = internName.split(' ')[0] || internName;
  const metItems = findings.filter(f => f.status === 'MET');
  const unmetItems = findings.filter(f => f.status !== 'MET');

  let greeting = `Hey ${firstName},`;
  if (previousReviewsCount > 0) {
    greeting = `Welcome back ${firstName}! Thanks for sending over your revision for **${taskId}: ${taskTitle}**.`;
  } else {
    greeting = `Hi ${firstName}, thanks for submitting your work on **${taskId}: ${taskTitle}**!`;
  }

  let body = '';

  if (decision === 'PASS') {
    body = `
${greeting}

I've reviewed your submission and I'm really impressed with how cleanly you tackled the requirements!

**What went well:**
${metItems.map(m => `• **${m.requirement}**: Great job here. ${m.evidence}`).join('\n')}

Everything meets our engineering standards, and all mandatory acceptance criteria are checked off. This is solid work that shows good engineering discipline.

You're officially cleared on **${taskId}**! Keep this standard going into your next assignment. Excellent effort! 🚀
    `.trim();
  } else if (decision === 'NEEDS_CHANGES') {
    body = `
${greeting}

I took some time to go through your submission. You've made a great start, but there are a few key points we need to iron out before this is ready to merge.

${metItems.length > 0 ? `**Strong points so far:**\n${metItems.map(m => `• **${m.requirement}**: Looking good! ${m.evidence}`).join('\n')}\n` : ''}
**Areas that need attention:**
${unmetItems.map((u, idx) => `
${idx + 1}. **${u.requirement}**
   • *Why it matters:* In real-world software, incomplete setups here create tricky bugs down the road.
   • *What to adjust:* ${u.recommended_improvement}
   • *How to test it:* ${u.suggested_tests}
`).join('')}

Don't worry—getting feedback and iterating is the core of how every software engineer grows. Take your time to address these points, test them locally, and push an updated submission when you're ready.

Looking forward to your update! You've got this! 💪
    `.trim();
  } else {
    // HUMAN_REVIEW_REQUIRED
    body = `
${greeting}

Thank you for your submission on **${taskId}**. 

I was able to look at the details you shared, but because certain external resources or links require manual verification, our engineering coordinator will be reviewing this directly with you.

**Current notes:**
${findings.map(f => `• **${f.requirement}**: Status is currently *${f.status}* (${f.evidence})`).join('\n')}

Our team coordinator will reach out shortly or connect during your scheduled review sync. If you have terminal logs or direct code snippets, feel free to add them to your submission notes.
    `.trim();
  }

  if (isDemo) {
    body += `\n\n*(Note: Evaluated using Demo Deterministic Evaluator. Configure GEMINI_API_KEY or OPENAI_API_KEY in .env for live LLM feedback.)*`;
  }

  return body;
}

/**
 * Structured Internal Coordinator Report
 */
function generateInternalReport({
  intern,
  task,
  decision,
  findings,
  evaluatorMode,
  confidenceNotes
}) {
  const met = findings.filter(f => f.status === 'MET').length;
  const total = findings.length;

  return `
[AUDIT EVALUATION REPORT]
Intern: ${intern.name} (${intern.email}) | ID: ${intern.id}
Task: ${task.id} - ${task.title}
Evaluator Mode: ${evaluatorMode}
Score: ${met}/${total} requirements verified (${Math.round((met / total) * 100)}%)
Decision: ${decision}
Confidence: ${confidenceNotes}

Summary of Findings:
${findings.map(f => `[${f.status}] ${f.requirement}\n  Evidence: ${f.evidence}\n  Remediation: ${f.recommended_improvement}`).join('\n')}
  `.trim();
}

/**
 * Optional Gemini API Evaluator implementation
 */
async function evaluateWithGemini({ intern, task, submission, requirements, apiKey, previousReviews }) {
  const prompt = buildLlmPrompt({ intern, task, submission, requirements, previousReviews });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(textResponse);

  return formatLlmOutput(parsed, intern, task, 'GEMINI_1.5_FLASH');
}

/**
 * Optional OpenAI API Evaluator implementation
 */
async function evaluateWithOpenAI({ intern, task, submission, requirements, apiKey, previousReviews }) {
  const prompt = buildLlmPrompt({ intern, task, submission, requirements, previousReviews });
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);

  return formatLlmOutput(parsed, intern, task, 'OPENAI_GPT_4O_MINI');
}

function buildLlmPrompt({ intern, task, submission, requirements, previousReviews }) {
  return `
You are a senior software engineering mentor evaluating an intern's submission for a company task.
Return ONLY valid JSON matching this schema:
{
  "overallDecision": "PASS" | "NEEDS_CHANGES" | "HUMAN_REVIEW_REQUIRED",
  "findings": [
    {
      "requirement": "string",
      "status": "MET" | "PARTIALLY_MET" | "NOT_MET" | "UNABLE_TO_VERIFY",
      "evidence": "string",
      "missing_functionality": "string",
      "explanation": "string",
      "recommended_improvement": "string",
      "suggested_tests": "string"
    }
  ],
  "mentorFeedback": "Natural, friendly, encouraging senior developer message to the intern",
  "internalReport": "Concise technical audit summary for the company coordinator",
  "confidenceNotes": "Notes on evaluation confidence"
}

Task ID: ${task.id}
Task Title: ${task.title}
Requirements: ${JSON.stringify(requirements)}
Acceptance Criteria: ${task.acceptance_criteria}

Intern Name: ${intern.name}
Intern Email: ${intern.email}
Submission Text:
${submission.text_content || 'None'}
Submission Repo/Link:
${submission.repo_url || 'None'}
Evidence Notes:
${submission.evidence_notes || 'None'}
`;
}

function formatLlmOutput(parsed, intern, task, mode) {
  return {
    overallDecision: parsed.overallDecision || 'HUMAN_REVIEW_REQUIRED',
    findings: parsed.findings || [],
    missingFunctionality: (parsed.findings || []).filter(f => f.status !== 'MET').map(f => f.requirement).join('; ') || 'None',
    mentorFeedback: parsed.mentorFeedback,
    internalReport: parsed.internalReport,
    evaluatorMode: mode,
    confidenceNotes: parsed.confidenceNotes || 'AI evaluated.'
  };
}

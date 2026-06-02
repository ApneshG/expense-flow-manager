import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.ADMIN_EMAIL || "akshatgera@gmail.com";
const APP_NAME = "Avi Tech Expense Manager";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function getBaseUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  }
  return "http://localhost:5000";
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.log(`[Email] SendGrid not configured. Would send to ${to}: ${subject}`);
    return false;
  }
  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: APP_NAME },
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to}: ${subject}`);
    return true;
  } catch (error: any) {
    console.error(`[Email] Failed to send to ${to}:`, error?.response?.body || error.message);
    return false;
  }
}

export async function sendInvitationEmail(
  toEmail: string,
  toName: string | null,
  role: string,
  token: string
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const registerUrl = `${baseUrl}/register?token=${token}`;
  const greeting = toName ? `Hi ${toName}` : "Hello";
  const roleDisplay = role.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; color: white; font-size: 24px; font-weight: bold; line-height: 40px;">A</div>
        <span style="font-size: 24px; font-weight: bold; margin-left: 10px; vertical-align: middle;">Avi Tech</span>
      </div>
      <h2 style="color: #1e293b;">${greeting},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        You've been invited to join the <strong>${APP_NAME}</strong> as a <strong>${roleDisplay}</strong>.
      </p>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Click the button below to create your account:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${registerUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Create Your Account
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 13px;">
        Or copy this link: <a href="${registerUrl}" style="color: #2563eb;">${registerUrl}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        ${APP_NAME} &bull; This invitation was sent to ${toEmail}
      </p>
    </div>
  `;

  return sendEmail(toEmail, `You're invited to join ${APP_NAME}`, html);
}

export async function sendPasswordResetEmail(
  toEmail: string,
  userName: string,
  token: string
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; color: white; font-size: 24px; font-weight: bold; line-height: 40px;">A</div>
        <span style="font-size: 24px; font-weight: bold; margin-left: 10px; vertical-align: middle;">Avi Tech</span>
      </div>
      <h2 style="color: #1e293b;">Hi ${userName},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        We received a request to reset your password. Click the button below to set a new password:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Reset Password
        </a>
      </div>
      <p style="color: #94a3b8; font-size: 13px;">
        Or copy this link: <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
      </p>
      <p style="color: #ef4444; font-size: 13px;">This link expires in 1 hour.</p>
      <p style="color: #94a3b8; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        ${APP_NAME} &bull; Password reset request
      </p>
    </div>
  `;

  return sendEmail(toEmail, `Reset your ${APP_NAME} password`, html);
}

export async function sendInviteRequestNotification(
  adminEmail: string,
  requesterName: string,
  requesterEmail: string,
  department: string | null,
  message: string | null
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const adminUrl = `${baseUrl}/admin`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; color: white; font-size: 24px; font-weight: bold; line-height: 40px;">A</div>
        <span style="font-size: 24px; font-weight: bold; margin-left: 10px; vertical-align: middle;">Avi Tech</span>
      </div>
      <h2 style="color: #1e293b;">New Invite Request</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Someone has requested access to the ${APP_NAME}:
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="margin: 5px 0; color: #1e293b;"><strong>Name:</strong> ${requesterName}</p>
        <p style="margin: 5px 0; color: #1e293b;"><strong>Email:</strong> ${requesterEmail}</p>
        ${department ? `<p style="margin: 5px 0; color: #1e293b;"><strong>Preferred Department:</strong> ${department}</p>` : ""}
        ${message ? `<p style="margin: 5px 0; color: #1e293b;"><strong>Message:</strong> ${message}</p>` : ""}
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${adminUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Review in Admin Panel
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        ${APP_NAME} &bull; Admin notification
      </p>
    </div>
  `;

  return sendEmail(adminEmail, `New access request from ${requesterName}`, html);
}

export async function sendExpenseCreatedEmail(
  employeeEmail: string,
  employeeName: string,
  hodEmail: string,
  hodName: string,
  expenseId: string,
  amount: number,
  category: string,
  description: string,
  billDate: string
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const expenseUrl = `${baseUrl}/my-expenses`;
  const reimbursementDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString();

  // Email to Employee
  const employeeHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; color: white; font-size: 24px; font-weight: bold; line-height: 40px;">A</div>
        <span style="font-size: 24px; font-weight: bold; margin-left: 10px; vertical-align: middle;">Avi Tech</span>
      </div>
      <h2 style="color: #1e293b;">Hi ${employeeName},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Your expense request has been submitted successfully!
      </p>
      <div style="background: #f0f9ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 8px 0; color: #1e293b;"><strong>Request ID:</strong> ${expenseId}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Category:</strong> ${category}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Bill Date:</strong> ${billDate}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Description:</strong> ${description}</p>
        <p style="margin: 8px 0; color: #16a34a;"><strong>Expected Reimbursement:</strong> ${reimbursementDate}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${expenseUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          View Request
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        ${APP_NAME} &bull; Your expense request has been submitted
      </p>
    </div>
  `;

  // Email to HoD
  const hodUrl = `${baseUrl}/approvals`;
  const actionDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString();
  
  const hodHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; color: white; font-size: 24px; font-weight: bold; line-height: 40px;">A</div>
        <span style="font-size: 24px; font-weight: bold; margin-left: 10px; vertical-align: middle;">Avi Tech</span>
      </div>
      <h2 style="color: #1e293b;">Hi ${hodName},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        A new expense request requires your approval.
      </p>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 8px 0; color: #1e293b;"><strong>Request ID:</strong> ${expenseId}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Employee:</strong> ${employeeName}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Category:</strong> ${category}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Bill Date:</strong> ${billDate}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Description:</strong> ${description}</p>
        <p style="margin: 8px 0; color: #dc2626;"><strong>Action Deadline:</strong> ${actionDeadline}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${hodUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Review Request
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        ${APP_NAME} &bull; Approval required
      </p>
    </div>
  `;

  await sendEmail(employeeEmail, `Expense Request Submitted - ID: ${expenseId}`, employeeHtml);
  return sendEmail(hodEmail, `New Expense Request Awaiting Approval - ID: ${expenseId}`, hodHtml);
}

export async function sendHoDActionEmail(
  employeeEmail: string,
  employeeName: string,
  expenseId: string,
  amount: number,
  category: string,
  status: string,
  hodName: string,
  hodComment: string | undefined
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const expenseUrl = `${baseUrl}/my-expenses`;
  const statusText = status === "pending_finance" ? "Approved" : status === "rejected_hod" ? "Rejected" : "Updated";
  const statusColor = status === "pending_finance" ? "#16a34a" : "#dc2626";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; color: white; font-size: 24px; font-weight: bold; line-height: 40px;">A</div>
        <span style="font-size: 24px; font-weight: bold; margin-left: 10px; vertical-align: middle;">Avi Tech</span>
      </div>
      <h2 style="color: #1e293b;">Hi ${employeeName},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        Your Head of Department has taken action on your expense request.
      </p>
      <div style="background: #f0f9ff; border-left: 4px solid ${statusColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 8px 0; color: #1e293b;"><strong>Request ID:</strong> ${expenseId}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Category:</strong> ${category}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Reviewed By:</strong> ${hodName}</p>
        ${hodComment ? `<p style="margin: 8px 0; color: #1e293b;"><strong>Comments:</strong> ${hodComment}</p>` : ""}
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${expenseUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          View Details
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        ${APP_NAME} &bull; Expense request updated
      </p>
    </div>
  `;

  return sendEmail(employeeEmail, `Expense Request ${statusText} - ID: ${expenseId}`, html);
}

export async function sendFinanceNotificationEmail(
  financeEmail: string,
  financeName: string,
  expenseId: string,
  amount: number,
  category: string,
  employeeName: string,
  hodName: string,
  hodComment: string | undefined
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const financeUrl = `${baseUrl}/finance`;
  const actionDeadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString();

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; color: white; font-size: 24px; font-weight: bold; line-height: 40px;">A</div>
        <span style="font-size: 24px; font-weight: bold; margin-left: 10px; vertical-align: middle;">Avi Tech</span>
      </div>
      <h2 style="color: #1e293b;">Hi ${financeName},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        A HoD-approved expense request is awaiting your review and payment processing.
      </p>
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 8px 0; color: #1e293b;"><strong>Request ID:</strong> ${expenseId}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Employee:</strong> ${employeeName}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>HoD:</strong> ${hodName}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Category:</strong> ${category}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
        ${hodComment ? `<p style="margin: 8px 0; color: #1e293b;"><strong>HoD Comments:</strong> ${hodComment}</p>` : ""}
        <p style="margin: 8px 0; color: #dc2626;"><strong>Action Deadline:</strong> ${actionDeadline}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${financeUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Review & Process
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        ${APP_NAME} &bull; Finance review required
      </p>
    </div>
  `;

  return sendEmail(financeEmail, `Approved Expense Awaiting Payment - ID: ${expenseId}`, html);
}

export async function sendFinanceActionEmail(
  employeeEmail: string,
  employeeName: string,
  expenseId: string,
  amount: number,
  category: string,
  status: string,
  financeName: string,
  financeComment: string | undefined,
  paymentMode?: string,
  paymentDate?: string
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const expenseUrl = `${baseUrl}/my-expenses`;
  const statusText = status === "paid" ? "Approved & Scheduled for Payment" : status === "needs_revision" ? "Needs Revision" : "On Hold";
  const statusColor = status === "paid" ? "#16a34a" : status === "needs_revision" ? "#dc2626" : "#f59e0b";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #2563eb; border-radius: 10px; color: white; font-size: 24px; font-weight: bold; line-height: 40px;">A</div>
        <span style="font-size: 24px; font-weight: bold; margin-left: 10px; vertical-align: middle;">Avi Tech</span>
      </div>
      <h2 style="color: #1e293b;">Hi ${employeeName},</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6;">
        ${status === "paid" ? "Your expense has been approved and payment is being processed!" : "Your expense request requires your attention."}
      </p>
      <div style="background: #f0f9ff; border-left: 4px solid ${statusColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 8px 0; color: #1e293b;"><strong>Request ID:</strong> ${expenseId}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Category:</strong> ${category}</p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
        <p style="margin: 8px 0; color: #1e293b;"><strong>Processed By:</strong> ${financeName}</p>
        ${paymentMode ? `<p style="margin: 8px 0; color: #1e293b;"><strong>Payment Mode:</strong> ${paymentMode}</p>` : ""}
        ${paymentDate ? `<p style="margin: 8px 0; color: #16a34a;"><strong>Expected Payment:</strong> ${paymentDate}</p>` : ""}
        ${financeComment ? `<p style="margin: 8px 0; color: #1e293b;"><strong>Comments:</strong> ${financeComment}</p>` : ""}
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${expenseUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          View Details
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">
        ${APP_NAME} &bull; Expense request updated
      </p>
    </div>
  `;

  return sendEmail(employeeEmail, `Expense Request ${statusText} - ID: ${expenseId}`, html);
}

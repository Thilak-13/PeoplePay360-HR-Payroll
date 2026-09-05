import React, { useState, useEffect } from 'react';
import {
  Send,
  MailCheck,
  Radio,
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Share2
} from 'lucide-react';
import { triggerBatchPayslipEmails, sendSingleNotification, fetchNotificationLogs } from './api';
import { EmailLogsTable } from './EmailLogsTable';

export const NotificationCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'logs'>('dispatch');
  const [payrunId, setPayrunId] = useState<number>(1);
  const [dispatching, setDispatching] = useState(false);
  const [customSending, setCustomSending] = useState(false);

  // Manual Compose form
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [notificationType, setNotificationType] = useState<any>('system_alert');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, sent: 0, queued: 0, failed: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const logs = await fetchNotificationLogs('all', 'all');
      const total = logs.length;
      const sent = logs.filter((l) => l.status === 'sent').length;
      const queued = logs.filter((l) => l.status === 'queued').length;
      const failed = logs.filter((l) => l.status === 'failed').length;
      setStats({ total, sent, queued, failed });
    } catch (e) {
      // ignore
    }
  };

  const handleBatchDispatch = async () => {
    setDispatching(true);
    setFeedback(null);
    try {
      const res = await triggerBatchPayslipEmails(payrunId);
      setFeedback({
        type: 'success',
        message: `Batch payslips dispatched successfully! Dispatched ${res.total_dispatched} employee email attachments for Payrun #${payrunId}.`,
      });
      loadStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to dispatch batch payslips' });
    } finally {
      setDispatching(false);
    }
  };

  const handleCustomSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSending(true);
    setFeedback(null);
    try {
      await sendSingleNotification({
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        notification_type: notificationType,
        subject,
        body,
      });
      setFeedback({ type: 'success', message: `Notification email dispatched to ${recipientEmail}!` });
      setRecipientEmail('');
      setRecipientName('');
      setSubject('');
      setBody('');
      loadStats();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.detail || 'Failed to send notification' });
    } finally {
      setCustomSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-7 h-7 text-indigo-600" />
            Notification & PDF Dispatch Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Automated PDF salary slip generation, batch email delivery, and transactional system notifications.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('dispatch')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'dispatch' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dispatcher Console
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Delivery Logs ({stats.total})
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          )}
          <span className="text-sm font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Dispatched</span>
            <Inbox className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Sent Successfully</span>
            <MailCheck className="w-5 h-5" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{stats.sent}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Queue</span>
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{stats.queued}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed / Bounced</span>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="text-2xl font-bold text-rose-700">{stats.failed}</div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'dispatch' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Batch Payslip Dispatcher */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-600">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Batch Payslip Email Dispatcher</h2>
                  <p className="text-xs text-slate-500">
                    Generates encrypted PDF payslips on-the-fly and sends transactional emails to all employees.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Target Payrun ID</label>
                  <input
                    type="number"
                    min={1}
                    value={payrunId}
                    onChange={(e) => setPayrunId(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Dispatches payslips to all employees included in Payrun #{payrunId}.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" /> Automated Pipeline
                  </div>
                  <div>• Formats earnings and deduction tables into ISO compliant PDF</div>
                  <div>• Attaches company header, employee metadata, and PAN/Bank details</div>
                  <div>• Queues background worker for asynchronous SMTP delivery</div>
                </div>
              </div>
            </div>

            <button
              onClick={handleBatchDispatch}
              disabled={dispatching}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              {dispatching ? 'Dispatching Batch Payslips...' : `Dispatch Payslips for Payrun #${payrunId}`}
            </button>
          </div>

          {/* Single Notification Composer */}
          <form onSubmit={handleCustomSend} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-purple-50 rounded-lg text-purple-600">
                <Share2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Compose System Notification</h2>
                <p className="text-xs text-slate-500">Send custom transactional notices, alerts, or status updates.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Email</label>
                <input
                  type="email"
                  required
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="employee@peoplepay360.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notification Category</label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="system_alert">System Alert</option>
                  <option value="leave_approval">Leave Approval</option>
                  <option value="loan_update">Loan Status Update</option>
                  <option value="expense_status">Expense Claim Notice</option>
                  <option value="tax_update">Tax Declaration Status</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Line</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Expense Claim #102 Approved"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notification Message Body</label>
              <textarea
                rows={3}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter notification details..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={customSending}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold text-sm rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {customSending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <EmailLogsTable />
      )}
    </div>
  );
};

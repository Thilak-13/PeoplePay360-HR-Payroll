import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, Clock, AlertTriangle, Download, RefreshCw, Filter, Paperclip } from 'lucide-react';
import { fetchNotificationLogs, getPayslipPdfUrl } from './api';
import { NotificationLog } from './types';

export const EmailLogsTable: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [typeFilter, statusFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchNotificationLogs(typeFilter, statusFilter);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" /> Sent
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3.5 h-3.5" /> Queued
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <AlertTriangle className="w-3.5 h-3.5" /> Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Notification Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="payslip_email">Payslip Email</option>
              <option value="leave_approval">Leave Approval</option>
              <option value="loan_update">Loan Update</option>
              <option value="expense_status">Expense Claim</option>
              <option value="tax_update">Tax Declaration</option>
              <option value="system_alert">System Alert</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        <button
          onClick={loadLogs}
          className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
          title="Refresh Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Recipient</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Attachment</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Sent At</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Mail className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    No notification logs found matching filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-500">#{log.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{log.recipient_name || 'Employee'}</div>
                      <div className="text-xs text-slate-500">{log.recipient_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {log.notification_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800 max-w-xs truncate">{log.subject}</td>
                    <td className="px-6 py-4">
                      {log.attachment_name ? (
                        <span className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                          <Paperclip className="w-3 h-3" />
                          PDF Attachment
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(log.status)}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {log.sent_at ? new Date(log.sent_at).toLocaleString() : 'Pending'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {log.attachment_name ? (
                        <a
                          href={getPayslipPdfUrl(log.id)}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 p-1.5 hover:bg-indigo-50 rounded transition-colors"
                          title="Download Generated PDF"
                        >
                          <Download className="w-4 h-4" /> Download PDF
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

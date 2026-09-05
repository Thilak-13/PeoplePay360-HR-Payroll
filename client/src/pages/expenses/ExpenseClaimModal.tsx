import React, { useState } from "react";
import { Receipt, X, DollarSign, Calendar, Tag, FileText } from "lucide-react";
import { submitExpenseClaim } from "./api";
import { ExpenseCategory } from "./types";

interface ExpenseClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const ExpenseClaimModal: React.FC<ExpenseClaimModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [employeeId, setEmployeeId] = useState(1);
  const [category, setCategory] = useState<ExpenseCategory>("travel");
  const [amount, setAmount] = useState(1500);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitExpenseClaim({
        employee_id: employeeId,
        category,
        amount,
        currency: "INR",
        expense_date: expenseDate,
        description,
        receipt_url: receiptUrl || undefined,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || "Failed to submit expense claim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">Submit New Expense Claim</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
              <input
                type="number"
                min={1}
                value={employeeId}
                onChange={(e) => setEmployeeId(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="travel">Travel & Transport</option>
                <option value="food">Meals & Entertainment</option>
                <option value="office_supplies">Office Supplies</option>
                <option value="client_entertainment">Client Meetings</option>
                <option value="training">Training & Certification</option>
                <option value="other">Other Operational</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={1}
                step={50}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt URL / Document Link</label>
            <input
              type="url"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://example.com/receipts/bill_101.pdf"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description & Business Justification</label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context on client name, project, or travel details..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm cursor-pointer"
            >
              {submitting ? "Submitting..." : "Submit Expense Claim"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

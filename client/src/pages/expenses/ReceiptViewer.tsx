import React from "react";
import { Receipt, CheckCircle, X, DollarSign, Calendar, Tag } from "lucide-react";
import { ExpenseClaim } from "./types";

interface ReceiptViewerProps {
  claim: ExpenseClaim | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptViewer: React.FC<ReceiptViewerProps> = ({ claim, isOpen, onClose }) => {
  if (!isOpen || !claim) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in text-white">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-slate-800 p-6 flex justify-between items-start border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-bold">Claim #{claim.id} - Receipt Proof</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {claim.employee ? `${claim.employee.first_name} ${claim.employee.last_name || ''}` : `Employee #${claim.employee_id}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Receipt Image / Proof */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-64 flex items-center justify-center p-2">
            {claim.receipt_url ? (
              <img
                src={claim.receipt_url}
                alt="Expense Receipt"
                className="object-contain max-h-60 rounded-lg"
              />
            ) : (
              <div className="text-slate-500 py-12">No digital receipt image attached.</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700">
            <div>
              <span className="text-slate-400">Category:</span>
              <div className="font-semibold text-white capitalize">{claim.category.replace("_", " ")}</div>
            </div>
            <div>
              <span className="text-slate-400">Amount:</span>
              <div className="font-semibold font-mono text-emerald-400 text-sm">
                {claim.currency} {Number(claim.amount).toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Expense Date:</span>
              <div className="text-white">{claim.expense_date}</div>
            </div>
            <div>
              <span className="text-slate-400">Status:</span>
              <div className="font-semibold uppercase text-blue-400">{claim.status}</div>
            </div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1">Description:</span>
            <p className="p-3 bg-slate-800/80 rounded-xl text-slate-200 border border-slate-700">
              {claim.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

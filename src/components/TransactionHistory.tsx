import React from "react";
import { TransactionRecord } from "../services/Stellar";
import "./TransactionHistory.css";

interface HistoryProps {
  transactions: TransactionRecord[];
  outcomes: Record<string, "WIN" | "LOSS">;
}

const TransactionHistory: React.FC<HistoryProps> = ({ transactions, outcomes }) => {
  return (
    <div className="history-card glass">
      <h3 className="label-prefix">RECENT_ACTIVITY_LOG</h3>
      <div className="tx-list">
        {transactions.length === 0 ? (
          <p className="no-tx">No transactions found.</p>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="tx-row">
              <div className="tx-header">
                <span className="tx-hash">#{tx.id.slice(0, 12)}...</span>
                <div className="tx-badges">
                  {outcomes[tx.id] && (
                    <span className={`tx-badge ${outcomes[tx.id].toLowerCase()}`}>
                      {outcomes[tx.id]}
                    </span>
                  )}
                  <span className={`tx-badge ${tx.successful ? "success" : "error"}`}>
                    {tx.successful ? "TX_OK" : "TX_ERR"}
                  </span>
                </div>
              </div>
              <div className="tx-info">
                <span className="tx-memo">{tx.memo}</span>
                <span className="tx-time">{new Date(tx.createdAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;

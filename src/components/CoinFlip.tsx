import React, { useState } from "react";
import "./CoinFlip.css";

interface CoinFlipProps {
  onFlip: (choice: "Heads" | "Tails", amount: string) => void;
  isFlipping: boolean;
  result?: "Heads" | "Tails";
  publicKey: string | null;
  balance: string;
}

const CoinFlip: React.FC<CoinFlipProps> = ({ onFlip, isFlipping, result, publicKey, balance }) => {
  const [choice, setChoice] = useState<"Heads" | "Tails">("Heads");
  const [amount, setAmount] = useState<string>("1.0");

  const handleFlip = () => {
    onFlip(choice, amount);
  };

  return (
    <div className="coin-flip-card glass">
      <div className="glitch-wrapper">
        <div 
          className={`glitch-content ${isFlipping ? "flipping" : ""}`}
          data-text={isFlipping ? "???" : (result || choice).toUpperCase()}
        >
          {isFlipping ? "???" : (result || choice).toUpperCase()}
        </div>
      </div>

      <div className="controls-section">
        <div className="control-group">
          <span className="header-label label-prefix">PREDICTION_NODE_ALPHA</span>
          <div className="line-divider"></div>
        </div>

        <div className="control-group">
          <label className="header-label">// BET_AMOUNT_XLM</label>
          <input 
            type="number" 
            step="0.1" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            disabled={isFlipping}
          />
        </div>

        <div className="choice-grid">
          <div 
            className={`choice-box ${choice === "Heads" ? "active" : ""}`}
            onClick={() => !isFlipping && setChoice("Heads")}
          >
            <h4>// HEADS</h4>
          </div>
          <div 
            className={`choice-box ${choice === "Tails" ? "active" : ""}`}
            onClick={() => !isFlipping && setChoice("Tails")}
          >
            <h4>// TAILS</h4>
          </div>
        </div>

        <div className="control-group">
          <div className="status-item">
            <span className="status-indicator"></span>
            <span className="header-label">
              {isFlipping ? "TNTTTATTNG..." : publicKey ? "SYSTEM_READY" : "AWAITING_AUTH"}
            </span>
          </div>
          <button 
            className="big-flip-btn" 
            onClick={handleFlip} 
            disabled={isFlipping || !amount || !publicKey}
          >
            START_FLIP
          </button>
        </div>

        {result && !isFlipping && (
          <div className={`result-banner ${result === choice ? "win" : "loss"}`}>
            // RESULT: {result === choice ? "SUCCESS_WIN" : "NODE_FAILURE_LOSS"}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoinFlip;

import React, { useState, useEffect } from "react";
import { stellar, TransactionRecord } from "./services/Stellar";
import CoinFlip from "./components/CoinFlip";
import TransactionHistory from "./components/TransactionHistory";
import "./App.css";

const App: React.FC = () => {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [balance, setBalance] = useState<string>("0");
    const [history, setHistory] = useState<TransactionRecord[]>([]);
    const [isFlipping, setIsFlipping] = useState(false);
    const [result, setResult] = useState<"Heads" | "Tails" | undefined>();
    const [theme, setTheme] = useState<"light" | "dark">("dark");
    const [time, setTime] = useState(new Date());
    const [stats, setStats] = useState({ wins: 0, losses: 0 });
    const [outcomes, setOutcomes] = useState<Record<string, "WIN" | "LOSS">>({});

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
        document.documentElement.setAttribute("data-theme", newTheme);
    };

    const connect = async () => {
        console.log("Connect button clicked");
        try {
            const pk = await stellar.connectWallet();
            console.log("Result from connectWallet:", pk);
            if (pk) {
                setPublicKey(pk);
                updateBalance(pk);
                updateHistory(pk);
            } else {
                const isInstalled = await stellar.isFreighterInstalled();
                if (!isInstalled) {
                    alert("Freighter wallet extension not detected. Please install it from freighter.app");
                } else {
                    alert("Could not retrieve your public key. Please make sure Freighter is unlocked and you have approved the connection.");
                }
            }
        } catch (err) {
            console.error("Error in connect handler:", err);
        }
    };

    const disconnect = () => {
        console.log("Disconnecting wallet...");
        setPublicKey(null);
        setBalance("0");
        setHistory([]);
        setResult(undefined);
    };

    const updateBalance = async (pk: string) => {
        const bal = await stellar.getAccountBalance(pk);
        setBalance(bal);
    };

    const updateHistory = async (pk: string) => {
        const hist = await stellar.getTransactionHistory(pk);
        setHistory(hist);
    };

    useEffect(() => {
        if (publicKey) {
            const interval = setInterval(() => {
                updateBalance(publicKey);
                updateHistory(publicKey);
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [publicKey]);

    const handleFlip = async (choice: "Heads" | "Tails", amount: string) => {
        if (!publicKey) return alert("Connect Wallet First!");

        setIsFlipping(true);
        setResult(undefined);

        // 1. Simulate game outcome FIRST (animation period)
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        const outcome = Math.random() > 0.5 ? "Heads" : "Tails";
        const isWin = outcome === choice;
        
        setResult(outcome);

        if (isWin) {
            // 2a. User WON - No deduction, just update stats
            console.log("Win detected - skipping transaction.");
            setStats(s => ({ ...s, wins: s.wins + 1 }));
            
            // Still fetch balance/history to ensure UI is in sync
            updateBalance(publicKey);
            updateHistory(publicKey);
        } else {
            // 2b. User LOST - Deduct amount (submit to Stellar)
            console.log("Loss detected - requesting payment...");
            const success = await stellar.sendFlipTransaction(publicKey, amount, choice, "LOSS");
            
            if (success) {
                setStats(s => ({ ...s, losses: s.losses + 1 }));
                
                // Fetch history to see the new loss record
                const newHistory = await stellar.getTransactionHistory(publicKey);
                if (newHistory.length > 0) {
                    const latestTx = newHistory[0];
                    setOutcomes(prev => ({ ...prev, [latestTx.id]: "LOSS" }));
                    setHistory(newHistory);
                }
                updateBalance(publicKey);
            } else {
                alert("Transaction failed or rejected. Loss not recorded.");
            }
        }

        setIsFlipping(false);
    };

    return (
        <div className={`app-container ${theme}`}>
            <header className="header">
                <div className="header-left">
                    <div className="header-item">
                        <span className="header-label">PROJECT:</span>
                        <span className="header-value">STELLAR_FLIP.OS</span>
                    </div>
                    <div className="header-item">
                        <span className="header-label">VERSION:</span>
                        <span className="header-value">0.1.0_STABLE</span>
                    </div>
                    <div className="header-item">
            <span className="header-label">AUTH:</span>
            <span className="header-value">
              {publicKey ? `FLEX_${publicKey.slice(0, 4)}...${publicKey.slice(-4)}` : "GUEST"}
            </span>
          </div>
          {publicKey && (
            <div className="header-item">
              <span className="header-label">BALANCE:</span>
              <span className="header-value">{balance} XLM</span>
            </div>
          )}
          <div className="header-item">
            <span className="header-label">SESSION_STATS:</span>
            <span className="header-value">W:{stats.wins} L:{stats.losses}</span>
          </div>
                </div>

                <div className="header-right">
                    <div className="header-item">
                        <span className="header-label">SYSTEM CLOCK:</span>
                        <span className="header-value">{time.toLocaleTimeString([], { hour12: false })}</span>
                    </div>
                    <div className="header-item">
                        <span className="header-label">UPTIME:</span>
                        <span className="header-value">99.8%</span>
                    </div>
                    <div className="header-actions">
                        <button className="theme-toggle" onClick={toggleTheme}>
                            TOGGLE_THEME
                        </button>
                        {publicKey ? (
                            <button className="disconnect-btn" onClick={disconnect}>
                                TERMINATE_SESSION
                            </button>
                        ) : (
                            <button className="connect-btn" onClick={connect}>
                                INIT_CONNECT
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <div className="line-divider"></div>

            <main className="main-content">
                <CoinFlip
                    onFlip={handleFlip}
                    isFlipping={isFlipping}
                    result={result}
                    publicKey={publicKey}
                    balance={balance}
                />
                <TransactionHistory transactions={history} outcomes={outcomes} />
            </main>

            <footer className="footer">
                <div>// STELLAR_FLIP.OS</div>
                <div>LAT: 18.807° N | LON: 84.141° E</div>
                <div>© 2026 FLEX_GEN_DESIGN</div>
            </footer>
        </div>
    );
};

export default App;

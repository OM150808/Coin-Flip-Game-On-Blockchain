import { 
  getPublicKey, 
  signTransaction, 
  isConnected as freighterIsConnected,
  setAllowed
} from "@stellar/freighter-api";
import * as StellarSdk from "stellar-sdk";

const HORIZON_NODES = [
  "https://horizon-testnet.stellar.org",
  "https://stellar-testnet.publicnode.com",
];

let currentServerIndex = 0;
let server = new StellarSdk.Horizon.Server(HORIZON_NODES[currentServerIndex]);

const rotateServer = () => {
  currentServerIndex = (currentServerIndex + 1) % HORIZON_NODES.length;
  console.warn(`Switching to fallback Horizon node: ${HORIZON_NODES[currentServerIndex]}`);
  server = new StellarSdk.Horizon.Server(HORIZON_NODES[currentServerIndex]);
  return server;
};

export interface TransactionRecord {
  id: string;
  hash: string;
  amount: string;
  memo: string;
  createdAt: string;
  successful: boolean;
}

export interface FlipResult {
  success: boolean;
  hash?: string;
  error?: string;
}

class StellarService {
  // Use explicit string to avoid any ambiguity with SDK constants
  private networkPassphrase = "Test SDF Network ; September 2015";
  // A simulated "House Address" on Testnet for the game to collect bets.
  // In a production app, this would be your game's escrow or a smart contract.
  private houseAddress = "GC2K2LRYUGTGJVYXNLBD232WQQJDBSW62YFM5VWS56JBGQIMCBCHSIHP"; // Testnet "Dead" house address

  async isFreighterInstalled() {
    console.log("Checking if Freighter is installed...");
    const connected = await freighterIsConnected();
    console.log("Freighter isConnected:", connected);
    return connected;
  }

  async connectWallet(): Promise<string | null> {
    console.log("Attempting to connect wallet...");
    try {
      const isInstalled = await this.isFreighterInstalled();
      if (!isInstalled) {
        console.warn("Freighter extension not detected");
        return null;
      }

      // Authorize the site
      console.log("Requesting site authorization...");
      const isAllowed = await setAllowed();
      console.log("Site authorization result:", isAllowed);
      
      if (!isAllowed) {
        console.warn("User did not authorize the site");
        return null;
      }

      const publicKey = await getPublicKey();
      console.log("Public key received from Freighter:", publicKey);
      
      if (!publicKey) {
        console.warn("Freighter returned an empty public key");
        return null;
      }
      
      return publicKey;
    } catch (error) {
      console.error("Wallet connection failed in StellarService:", error);
      return null;
    }
  }

  async getAccountBalance(publicKey: string): Promise<string> {
    try {
      console.log(`Fetching balance for ${publicKey} from ${HORIZON_NODES[currentServerIndex]}...`);
      const account = await server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(b => b.asset_type === "native");
      return nativeBalance ? nativeBalance.balance : "0";
    } catch (err: any) {
      console.error("Failed to load account:", err);
      if (err.message && (err.message.includes("Network Error") || err.message.includes("ERR_NAME_NOT_RESOLVED"))) {
        rotateServer();
        // Retry once with new server
        try {
          const account = await server.loadAccount(publicKey);
          const nativeBalance = account.balances.find(b => b.asset_type === "native");
          return nativeBalance ? nativeBalance.balance : "0";
        } catch (retryErr) {
          console.error("Retry failed after server rotation:", retryErr);
        }
      }
      return "0";
    }
  }

  async sendFlipTransaction(
    senderPublicKey: string,
    amount: string,
    choice: "Heads" | "Tails",
    outcome: "WIN" | "LOSS"
  ): Promise<FlipResult> {
    try {
      const account = await server.loadAccount(senderPublicKey);

      // Send the bet amount to the house address as proof-of-play on Testnet
      const destination = this.houseAddress;

      console.log("Building transaction for network:", this.networkPassphrase);
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination,
            asset: StellarSdk.Asset.native(),
            amount: amount,
          })
        )
        .addMemo(StellarSdk.Memo.text(`Flip:${choice[0]}|${outcome}`))
        .setTimeout(30)
        .build();

      const xdr = transaction.toXDR();
      console.log("Transaction XDR created, sending to Freighter...");

      const signedXdr = await signTransaction(xdr, {
        networkPassphrase: this.networkPassphrase,
      });

      console.log("Transaction signed by Freighter.");

      const submitTx = async (xdrStr: string): Promise<FlipResult> => {
        try {
          const submitted = await server.submitTransaction(
            StellarSdk.TransactionBuilder.fromXDR(xdrStr, this.networkPassphrase)
          );
          console.log("Transaction submitted successfully:", submitted.hash);
          return { success: true, hash: submitted.hash };
        } catch (err: any) {
          console.error("Submission failed:", err);
          if (err.response?.data?.extras?.result_codes) {
            console.error("Horizon Result Codes:", err.response.data.extras.result_codes);
          }
          const isNetworkErr =
            err.message &&
            (err.message.includes("Network Error") || err.message.includes("ERR_NAME_NOT_RESOLVED"));
          if (isNetworkErr) {
            rotateServer();
            console.log("Retrying submission with fallback node...");
            try {
              const retried = await server.submitTransaction(
                StellarSdk.TransactionBuilder.fromXDR(xdrStr, this.networkPassphrase)
              );
              return { success: true, hash: retried.hash };
            } catch (retryErr: any) {
              console.error("Submission retry failed:", retryErr);
              return { success: false, error: retryErr?.message ?? "Retry failed" };
            }
          }
          return { success: false, error: err?.message ?? "Submission failed" };
        }
      };

      return submitTx(signedXdr);
    } catch (error: any) {
      console.error("Transaction flow error:", error);
      return { success: false, error: error?.message ?? "Transaction failed" };
    }
  }

  async getTransactionHistory(publicKey: string): Promise<TransactionRecord[]> {
    try {
      console.log(`Fetching history for ${publicKey} from ${HORIZON_NODES[currentServerIndex]}...`);
      const response = await server.transactions()
        .forAccount(publicKey)
        .order("desc")
        .limit(10)
        .call();

      return response.records.map(record => ({
        id: record.id,
        hash: record.hash,
        amount: "",
        memo: record.memo || "",
        createdAt: record.created_at,
        successful: record.successful,
      }));
    } catch (err: any) {
      console.error("Failed to fetch history:", err);
      if (err.message && (err.message.includes("Network Error") || err.message.includes("ERR_NAME_NOT_RESOLVED"))) {
        rotateServer();
        try {
          const response = await server.transactions()
            .forAccount(publicKey)
            .order("desc")
            .limit(10)
            .call();

          return response.records.map(record => ({
            id: record.id,
            hash: record.hash,
            amount: "",
            memo: record.memo || "",
            createdAt: record.created_at,
            successful: record.successful,
          }));
        } catch (retryErr) {
          console.error("Retry failed after server rotation:", retryErr);
        }
      }
      return [];
    }
  }
}

export const stellar = new StellarService();

#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
};

mod test;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InsufficientBalance = 3,
    Overflow = 4,
}

#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Choice {
    Heads = 0,
    Tails = 1,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    TotalPlays,
    TotalBets,
    TotalPayouts,
}

#[contract]
pub struct CoinFlipContract;

#[contractimpl]
impl CoinFlipContract {
    /// Initialize the contract with an admin and the token (e.g. XLM) to be used.
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::TotalPlays, &0u64);
        env.storage().instance().set(&DataKey::TotalBets, &0i128);
        env.storage().instance().set(&DataKey::TotalPayouts, &0i128);
        Ok(())
    }

    /// Perform the coin flip.
    /// User must authorize the transfer of 'amount' tokens.
    pub fn flip(env: Env, user: Address, choice: Choice, amount: i128) -> Result<bool, Error> {
        user.require_auth();

        let token_addr = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);

        // Check user balance first for early failure
        if token_client.balance(&user) < amount {
            return Err(Error::InsufficientBalance);
        }

        // Transfer bet from user to this contract
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Update stats: Increment plays and bets
        let plays: u64 = env.storage().instance().get(&DataKey::TotalPlays).unwrap_or(0);
        let bets: i128 = env.storage().instance().get(&DataKey::TotalBets).unwrap_or(0);
        
        env.storage().instance().set(&DataKey::TotalPlays, &(plays + 1));
        env.storage().instance().set(&DataKey::TotalBets, &(bets + amount));

        // Random roll: 0 or 1
        let result_roll = env.prng().gen_range(0..=1);
        
        let win = match choice {
            Choice::Heads => result_roll == 0,
            Choice::Tails => result_roll == 1,
        };

        if win {
            // User wins! Pay out 2x the bet
            let payout = amount.checked_mul(2).ok_or(Error::Overflow)?;
            
            // Check house balance
            if token_client.balance(&env.current_contract_address()) < payout {
                // In a real app, you might want to revert or handle this gracefully.
                // Here we panic or return error if house is broke.
                return Err(Error::InsufficientBalance);
            }

            token_client.transfer(&env.current_contract_address(), &user, &payout);
            
            // Update stats: Total Payouts
            let total_payouts: i128 = env.storage().instance().get(&DataKey::TotalPayouts).unwrap_or(0);
            env.storage().instance().set(&DataKey::TotalPayouts, &(total_payouts + payout));
        }

        // Emit Event
        let choice_sym = if choice == Choice::Heads { symbol_short!("heads") } else { symbol_short!("tails") };
        env.events().publish(
            (symbol_short!("flip"), user),
            (choice_sym, win, amount),
        );

        Ok(win)
    }

    /// Get current game statistics: (plays, bets, payouts)
    pub fn get_stats(env: Env) -> (u64, i128, i128) {
        let plays = env.storage().instance().get(&DataKey::TotalPlays).unwrap_or(0);
        let bets = env.storage().instance().get(&DataKey::TotalBets).unwrap_or(0);
        let payouts = env.storage().instance().get(&DataKey::TotalPayouts).unwrap_or(0);
        (plays, bets, payouts)
    }

    /// Admin-only: withdraw funds from the contract
    pub fn withdraw(env: Env, amount: i128) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        let token_addr = env
            .storage()
            .instance()
            .get::<_, Address>(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);

        token_client.transfer(&env.current_contract_address(), &admin, &amount);
        Ok(())
    }
}

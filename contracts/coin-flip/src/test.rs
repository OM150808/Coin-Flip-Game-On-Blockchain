#![cfg(test)]
use super::{Choice, CoinFlipContract, CoinFlipContractClient};
use soroban_sdk::{testutils::{Address as _, Events, Ledger}, token, Address, Env, symbol_short};

#[test]
fn test_coin_flip_all_features() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CoinFlipContract);
    let client = CoinFlipContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    
    // Register the token contract for XLM simulation
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::Client::new(&env, &token_id);

    // Initialize the game
    client.initialize(&admin, &token_id);

    // Fund the contract (house) and user
    token_client.mint(&user, &1000);
    token_client.mint(&contract_id, &10000);

    // Mock RNG to guaranteed win (Choice Heads=0, Roll 0)
    env.prng().seed([0; 32]); 

    let bet_amount = 100;
    let _ = client.flip(&user, &Choice::Heads, &bet_amount);
    
    // 1. Verify Balances after Win
    assert_eq!(token_client.balance(&user), 1100);
    assert_eq!(token_client.balance(&contract_id), 10000 - 100); // Net loss for house is 100

    // 2. Verify Stats
    let (plays, bets, payouts) = client.get_stats();
    assert_eq!(plays, 1);
    assert_eq!(bets, 100);
    assert_eq!(payouts, 200);

    // 3. Verify Events
    let events = env.events().all();
    let last_event = events.last().unwrap();
    // (symbol_short!("flip"), user), (choice_sym, win, amount)
    assert_eq!(last_event.event.topics.get(0).unwrap(), symbol_short!("flip").into());
    assert_eq!(last_event.event.topics.get(1).unwrap(), user.into());
}

#[test]
fn test_insufficient_balance() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CoinFlipContract);
    let client = CoinFlipContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let token_admin = Address::generate(&env);
    
    let token_id = env.register_stellar_asset_contract(token_admin.clone());
    client.initialize(&admin, &token_id);

    // No balance for user
    let res = client.try_flip(&user, &Choice::Heads, &100);
    assert!(res.is_err());
}

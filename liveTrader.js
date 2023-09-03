const axios = require('axios');
const { ethers } = require('ethers');

const CH_ABI = require("./abi/ClearingHouse.json");
const ERC20_ABI = require("./abi/ERC20.json");

class liveTrader {

    constructor(signer, amm, leverage=1, testnet = true) {
        this.signer = signer;
        this.PUBLIC_KEY = signer.address;
        this.amm = amm;
        this.DOMAIN_NAME = testnet ? 'https://api.nftperp.xyz' : 'https://live.nftperp.xyz';
        this.leverage = ethers.utils.parseUnits(leverage.toString(), 18);
    }

    //initialize the contracts
    async initialize(){
        let res = await axios.get(`${this.DOMAIN_NAME}/contracts`);        
        this.ADDRESSES = res.data.data;
        this.clearingHouse = new ethers.Contract(this.ADDRESSES.clearingHouse, CH_ABI.abi, this.signer);
        this.AMM_ADDRESS = this.ADDRESSES.amms[this.amm];
    }

    async getPrice(){
        const res = await axios.get(`${this.DOMAIN_NAME}/markPrice?amm=${this.amm}`);
        return res.data.data;
    }

    async getPosition() {
        const res = await axios.get(`${this.DOMAIN_NAME}/position?amm=${this.amm}&trader=${this.PUBLIC_KEY}`);
        return res.data.data;
    }

    async getBalance() {
        const wethContract = new ethers.Contract(this.ADDRESSES.weth, ERC20_ABI.abi, this.signer);
        const wethBalanceWei = await wethContract.balanceOf(this.PUBLIC_KEY);
        const wethBalanceEth = ethers.utils.formatEther(wethBalanceWei);
        return wethBalanceEth;
    }

    async getETHBalance(){
        const balanceWei = await this.signer.getBalance();
        const balanceEth = ethers.utils.formatEther(balanceWei);
        return balanceEth;
    }

    async cancelAllLimitOrders() {
        const res = await axios.get(`${this.DOMAIN_NAME}/orders?amm=${this.amm}&trader=${this.PUBLIC_KEY}`);
        const orders = res.data.data;

        for (const order of orders) {
            const tx = await this.clearingHouse.deleteLimitOrder(String(order.id));
        }
    }

    async createLimitOrder(side, price, amount) {
        const Side = { LONG: 0, SHORT: 1 }; 
        
        const order = {
            trader: this.PUBLIC_KEY,
            amm: this.AMM_ADDRESS,
            side: Side[side.toUpperCase()],
            trigger: ethers.utils.parseUnits(price.toString(), 18),
            quoteAmount: ethers.utils.parseUnits(amount.toString(), 18),
            leverage: this.leverage,
            reduceOnly: false
        };

        console.log({
            trader: this.PUBLIC_KEY,
            amm: this.AMM_ADDRESS,
            side: side.toUpperCase(),
            trigger: price.toString(),
            quoteAmount: amount.toString(),
            leverage: this.leverage,
            reduceOnly: false
        })

        const tx = await this.clearingHouse.createLimitOrder(order);
        await tx.wait();
    
        return tx;
    }

    async sumBuyAndSellOrders() {
        const res = await axios.get(`${this.DOMAIN_NAME}/orders?amm=${this.amm}&trader=${this.PUBLIC_KEY}`);
        const orders = res.data.data;

        let buySum = 0;
        let sellSum = 0;

        for (const order of orders) {
            if (order.side === 0) {
                buySum += order.size * order.price;
            } else {
                sellSum += order.size * order.price;
            }
        }

        return { buySum, sellSum };
    }
}

module.exports = liveTrader;
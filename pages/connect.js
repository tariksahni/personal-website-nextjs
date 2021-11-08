/* Node Dependencies */
import React, {useEffect, useState} from 'react';
import { ethers } from "ethers";

/* Components */
import SocialMedia from 'Components/socialMedia';
import Conditional from 'Components/conditional';

/* Constants */
import {MESSAGE_WALL_CONTRACT_ADDRESS} from 'Constants/index';
import messageWallContractABI from 'Constants/messageWallContractABI.json';


const ConnectMe = () => {
	const [currentAccount, setCurrentAccount] = useState('');
	const [currentState, setCurrentState] = useState({
		isWalletConnected: false,
		isWalletInstalled: false
	});
	const checkIfWalletIsConnected = async () => {
		try {
			const {ethereum} = window;
			if (!ethereum) {
				return;
			}
			const accounts = await ethereum.request({method: 'eth_accounts'});
			if (accounts.length !== 0) {
				const account = accounts[0];
				setCurrentAccount(account);
				setCurrentState({
					isWalletConnected: true,
					isWalletInstalled: true
				});

			} else {
				setCurrentState({
					isWalletConnected: false,
					isWalletInstalled: true
				});
			}
		} catch (error) {
			console.log(error);
		}
	}

	const connectWallet = async () => {
		try {
			const {ethereum} = window;
			if (!ethereum) {
				setCurrentState({
					isWalletConnected: false,
					isWalletInstalled: false
				});
				return;
			}
			const accounts = await ethereum.request({method: 'eth_requestAccounts'});
			setCurrentAccount(accounts[0]);
			setCurrentState({
				isWalletConnected: true,
				isWalletInstalled: true
			});
		} catch (error) {
			console.log(error)
		}
	}

	const waveMe = async () => {
		try {
			const { ethereum } = window;
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const messageWallContract = new ethers.Contract(MESSAGE_WALL_CONTRACT_ADDRESS, messageWallContractABI.abi, signer);
				let messageCount;
				messageCount = await messageWallContract.getTotalMessageCount();
				let messageTxn = await messageWallContract.incrementMessageCount();
				await messageTxn.wait();

				messageCount = await messageWallContract.getTotalMessageCount();
			} else {
				setCurrentState({
					isWalletConnected: false,
					isWalletInstalled: false
				});
			}
		} catch (error) {
			console.log(error)
		}
	}

	useEffect(() => {
		checkIfWalletIsConnected().then();
	}, []);
	const {isWalletConnected, isWalletInstalled} = currentState;
	return (
		<div className={'connect-me-container'}>
			<div className="intro-connect">
				<h6 className="open-sans-font upper-case hi-text fs-3 fw-normal">Hi there ! &#128075;</h6>
				<h1 className="yellow-color poppins-font upper-case fw-bold fs-5">
					<span className="my-details white-color">{`Let's talk on `}</span>
					Blockchain
				</h1>
			</div>
			<div className="about-me-container yellow-color-background mt-2 cursor-pointer">
				<Conditional if={!isWalletInstalled}>
					<a href={'https://metamask.io/'} className="download-pdf-anchor" target={'_blank'} rel="noreferrer" >
						<span
							className="black-color upper-case fs-2  fw-bold open-sans-font">Get Metamask &nbsp; 💳
						</span>
					</a>
				</Conditional>
				<Conditional if={!isWalletConnected && isWalletInstalled}>
					<div onClick={connectWallet} className="download-pdf-anchor" >
						<span
							className="black-color upper-case fs-2  fw-bold open-sans-font">Connect Metamask &nbsp; 🔓
						</span>
					</div>
				</Conditional>
				<Conditional if={isWalletConnected}>
					<div onClick={waveMe} className="download-pdf-anchor" >
						<span
							className="black-color upper-case fs-2  fw-bold open-sans-font">Wave at me! &nbsp; 🙋‍♂️
						</span>
					</div>
				</Conditional>
			</div>
			<SocialMedia/>
		</div>

	)
}

export default ConnectMe;

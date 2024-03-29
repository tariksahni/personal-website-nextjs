/* Node Dependencies */
import React, {useEffect, useState} from 'react';
import { ethers } from "ethers";

/* Components */
import SocialMedia from 'Components/socialMedia';
import MessageBlock from 'Components/messageBlock';
import Conditional from 'Components/conditional';

/* Constants */
import {MESSAGE_WALL_CONTRACT_ADDRESS, WHATSAPP_URL} from 'Constants/index';
import messageWallContractABI from 'Constants/messageWallContractABI.json';


const ConnectMe = () => {
	const [currentAccount, setCurrentAccount] = useState('');
	const [messageContent, setMessageContent] = useState('');
	const [currentState, setCurrentState] = useState({
		isWalletConnected: false,
		isWalletInstalled: false
	});
	const [totalMessageCount, setMessageCount] = useState(0);
	const [messages, setMessages] = useState(null);
	const [isMinting, setIsMinting] = useState(false);

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
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const messageWallContract = new ethers.Contract(MESSAGE_WALL_CONTRACT_ADDRESS, messageWallContractABI.abi, signer);
				const messageCount = await messageWallContract.getTotalMessageCount();
				const messages = await messageWallContract.getMessages();
				if(messageCount) setMessageCount(messageCount.toNumber());
				let filteredMessages = [];
				messages.forEach(message => {
					filteredMessages.push({
						sender: message.sender,
						timestamp: new Date(message.timestamp * 1000)?.toString(),
						message: message.message,
						timestampNum: message.timestamp * 1000,
					});
				});
				if(filteredMessages.length > 0) setMessages(filteredMessages);
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
				if(messageContent) {
					let messageTxn = await messageWallContract.setMessage(messageContent, { gasLimit: 300000 });
					setIsMinting(true);
					await messageTxn.wait();
					setIsMinting(false);
					const messageCount = await messageWallContract.getTotalMessageCount();
					if (messageCount) setMessageCount(messageCount.toNumber());
					const messages = await messageWallContract.getMessages();
					let filteredMessages = [];
					messages.forEach(message => {
						filteredMessages.push({
							sender: message.sender,
							timestamp: new Date(message.timestamp * 1000)?.toString(),
							timestampNum: message.timestamp * 1000,
							message: message.message
						});
					});
					if(filteredMessages.length > 0) setMessages(filteredMessages);
					setMessageCount('');
				}
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

	// useEffect(() => {
	// 	let messageWallContract;
	// 	const {ethereum} = window;
	// 	const onNewConcurrentMessage = (message, sender, timestamp) => {
	// 		setMessages(prevState => [
	// 			...prevState,
	// 			{
	// 				sender: sender,
	// 				timestamp: new Date(timestamp * 1000)?.toString(),
	// 				timestampNum: timestamp * 1000,
	// 				message
	// 			},
	// 		]);
	// 	};
	//
	// 	if (ethereum) {
	// 		const provider = new ethers.providers.Web3Provider(window.ethereum);
	// 		const signer = provider.getSigner();
	//
	// 		messageWallContract = new ethers.Contract(MESSAGE_WALL_CONTRACT_ADDRESS, messageWallContractABI.abi, signer);
	// 		messageWallContract.on('NewMessage', onNewConcurrentMessage);
	// 	}
	//
	// 	return () => {
	// 		if (messageWallContract) {
	// 			messageWallContract.off('NewMessage', onNewConcurrentMessage);
	// 		}
	// 	};
	// }, []);

	useEffect(() => {
		checkIfWalletIsConnected().then();
	}, [currentState]);
	const {isWalletConnected, isWalletInstalled} = currentState;
	return (
		<div className={'connect-me-container'}>
			<div className="intro-connect">
				<h6 className="open-sans-font  hi-text fs-3 fw-normal">Hi, Tarik here ! &#128075; 🇮🇳</h6>
				<h1 className="yellow-color poppins-font upper-case fw-bold fs-5">
					<span className="my-details white-color">{`Let's `}</span>
					Connect
				</h1>
			</div>
			<textarea
				placeholder={'Send me a message...'}
				className={'message-input'}
				onChange={ (e) => setMessageContent(e.target.value)}
			/>
			<div className="about-me-container yellow-color-background mt-1 cursor-pointer">
			{/*<Conditional if={!isWalletInstalled}>*/}
			{/*	<a href={'https://metamask.io/'} className="download-pdf-anchor" target={'_blank'} rel="noreferrer" >*/}
			{/*			<span*/}
			{/*				className="black-color upper-case fs-2  fw-bold open-sans-font">Get Metamask &nbsp; 💳*/}
			{/*			</span>*/}
			{/*	</a>*/}
			{/*</Conditional>*/}
			{/*<Conditional if={!isWalletConnected && isWalletInstalled}>*/}
			{/*	<div onClick={connectWallet} className="download-pdf-anchor" >*/}
			{/*			<span*/}
			{/*				className="black-color upper-case fs-2  fw-bold open-sans-font">Send Whatsapp 💬*/}
			{/*			</span>*/}
			{/*	</div>*/}
			{/*</Conditional>*/}

			<a href={`${WHATSAPP_URL}?text=${messageContent}`} target={'_blank'} rel={'noreferrer'} className="download-pdf-anchor" >
				<span
					className="black-color upper-case fs-2  fw-bold open-sans-font">Send Whatsapp 💬
				</span>
			</a>
			{/*<Conditional if={isWalletConnected && !isMinting}>*/}
			{/*	<div onClick={waveMe} className="download-pdf-anchor" >*/}
			{/*			<span*/}
			{/*				className="black-color upper-case fs-2  fw-bold open-sans-font">Wave at me! &nbsp; 🙋‍♂️*/}
			{/*			</span>*/}
			{/*	</div>*/}
			{/*</Conditional>*/}
			{/*<Conditional if={isMinting && isWalletConnected}>*/}
			{/*	<div className="download-pdf-anchor" >*/}
			{/*			<span*/}
			{/*				className="black-color upper-case fs-2  fw-bold open-sans-font">Minting in progress &nbsp;*/}
			{/*			</span>*/}
			{/*		<div className="ball-element ball1"/>*/}
			{/*		&nbsp;&nbsp;*/}
			{/*		<div className="ball-element ball2"/>*/}
			{/*		&nbsp;&nbsp;*/}
			{/*		<div className="ball-element ball3"/>*/}

			{/*	</div>*/}
			{/*</Conditional>*/}
		</div>
			{/*<Conditional if={messages && messages.length > 0}>*/}
			{/*	<div className={'message-section-container'}>*/}
			{/*		{messages?.sort( (a, b) => b.timestampNum - a.timestampNum)?.map( ({message, sender, timestamp, timestampNum}) => <MessageBlock message={message} sender={sender} timestamp={timestamp} key={timestampNum}/>)}*/}
			{/*	</div>*/}
			{/*</Conditional>*/}

			<SocialMedia/>
			{/*<div className="yellow-color poppins-font fw-bold fs-2 position-left-bottom-fixed">*/}
			{/*	<span className="my-details white-color">{`Available at `}</span>*/}
			{/*	7831838003:&nbsp;*/}
			{/*	<span className="my-details white-color">7831838003</span>*/}
			{/*</div>*/}
		</div>

	)
}

export default ConnectMe;

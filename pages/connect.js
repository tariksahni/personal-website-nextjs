/* Node Dependencies */
import React, {useState} from 'react';

/* Components */
import SocialMedia from 'Components/socialMedia';

/* Constants */
import {WHATSAPP_URL} from 'Constants/index';


const ConnectMe = () => {
	const [messageContent, setMessageContent] = useState('');

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
				<a href={`${WHATSAPP_URL}?text=${messageContent}`} target={'_blank'} rel={'noreferrer'} className="download-pdf-anchor" >
					<span className="upper-case fs-2 fw-bold open-sans-font" style={{color: '#fff'}}>Send Whatsapp 💬</span>
				</a>
			</div>

			<SocialMedia/>
		</div>

	)
}

export default ConnectMe;

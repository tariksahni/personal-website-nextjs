/* Node Dependencies */
import React from 'react';

const MessageBlock = ({message, sender, timestamp}) => {
	// const {name, address, time} =  messageInfo;
	return (
		<div className={'message-element'}>
			<div className={'message-content'}>
				<span className={'poppins-font fs-2 fw-medium  white-color line-height-2'}>
					{message}
				</span>
			</div>
			<div className={'bottom-container'}>
				<h4 className={'open-sans-font yellow-color address mt'} title={sender}>{sender}</h4>
				<h4 className={'open-sans-font  yellow-color mt ml-1'}>{timestamp} </h4>
			</div>
		</div>
	)
};

export default MessageBlock;

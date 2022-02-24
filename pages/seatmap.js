import React, {useRef} from 'react';

const SeatMap = () => {
	const iframeNode = useRef(null);
	const iframeOnLoad = () => {
		const iframeWindow = iframeNode.current.contentWindow;
		console.log("aaya check", iframeWindow, iframeNode);
	}
	return (
		<div className={'seatmap-container'}>
			<iframe
				title="Seat Selection"
				src={'https://www.test-headout.com/seatmap/tour-group/3023?date=2022-02-26&time=19:30:00&showOnly=true&currencyCode=USD'}
				onLoad={iframeOnLoad}
				ref={iframeNode}
			></iframe>
		</div>
	)
}

export default SeatMap;

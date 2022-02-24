import React, {useEffect, useState} from 'react';

const SeatMap = () => {
	return (
		<div className={'seatmap-container'}>
			<iframe
				title="Seat Selection"
				src={'https://www.headout.com/seatmap/tour-group/3023?date=2022-02-26&time=19:30:00&showOnly=true&currencyCode=USD'}
			></iframe>
		</div>
	)
}

export default SeatMap;

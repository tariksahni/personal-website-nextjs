import React, {useRef} from 'react';

const SeatMap = () => {
	const iframeNode = useRef(null);

	const seatMapListener = {
		iframeInitCompleted: () => {
			const {
				product: { currency },
				date,
				filteredTime,
			} = this.props;
			const iframeWindow = this.seatmapIframe.contentWindow;

			if (filteredTime && iframeWindow) {
				iframeWindow.initPlugin({
					date,
					time: filteredTime,
					currencyCode: currency ? currency?.code : null,
					deviceType: 'DESKTOP',
				});

				this.setState({
					doesAcceptInputFromListener:
					iframeWindow.doesAcceptInputFromListener,
				});
			}
		},

		onSeatAdded: seat => {
			const {
				product: { id },
			} = this.props;
			trackEvent({
				eventName: 'Experience Seat Selected',
				'Tour Group ID': id,
			});
			this.setState({
				lastAddedSeat: seat,
			});
		},

		onSeatRemoved: seat => {
			this.setState({
				lastRemovedSeat: seat,
			});
		},

		onSeatSelectionChanged: seatsSelected => {
			this.setState({
				currentSelectedSeats: seatsSelected,
			});
		},

		onSeatSelectionSubmitted: seatsSelected => {
			this.props.onSeatMapChange({ seatMapInfo: seatsSelected });
		},

		initializingSeatmapStarted: () => {},

		initializingSeatmapCompleted: () => {
			const {
				product: { currency },
				date,
				filteredTime,
			} = this.props;
			const iframeWindow = this.seatmapIframe.contentWindow;

			if (filteredTime && iframeWindow) {
				iframeWindow.setInventorySlot({
					date,
					time: filteredTime,
					currencyCode: currency ? currency?.code : null,
				});
			}
		},

		inventoryUpdateStarted: () => {},

		inventoryUpdateCompleted: (inventoryMap, currency) => {
			this.setState({
				seatmapLoaded: true,
				currentInventoryMap: inventoryMap,
				currentCurrency: currency,
			});
		},

		onZoomLevelChanged: () => {},

		onZoomInDoubleClick: () => {},

		onZoomInButtonClick: () => {},

		onZoomOutButtonClick: () => {},

		onZoomResetButtonClick: () => {},

		onPriceFilterClick: filters => {
			this.setState({
				currentAppliedFilters: filters,
			});
		},

		onSeatsViewExpanded: () => {},
	};

	const iframeOnLoad = () => {
		const iframeWindow = iframeNode.current.contentWindow;
		console.log("aaya check", iframeWindow, iframeNode.current);
		//iframeWindow.init(seatMapListener)
	}
	return (
		<div className={'seatmap-container'}>
			<iframe
				title="Seat Selection"
				src={'https://www.stage-headout.com/seatmap/tour-group/3023?date=2022-02-26&time=19:30:00&showOnly=true&currencyCode=USD'}
				onLoad={iframeOnLoad}
				ref={iframeNode}
			></iframe>
		</div>
	)
}

export default SeatMap;

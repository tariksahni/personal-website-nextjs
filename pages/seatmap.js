import React from 'react';

class SeatMap extends React.Component{

 	seatMapListener = {
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
			console.log("onSeatSelectionSubmitted", seatsSelected)
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
	componentDidMount() {
		window.addEventListener(
			'message',
			(e) => {
				console.log(e);
			},
			true
		);
	}

	onIframeLoaded = () => {
		const iframeWindow = this.seatmapIframe.contentWindow;
		console.log("aaya check", iframeWindow);
		// iframeWindow.init(seatMapListener)
	}

	render () {
		return (
			<div className={'seatmap-container'}>
				<iframe
					title="Seat Selection"
					src={'https://www.stage-headout.com/seatmap/tour-group/3023?date=2022-02-26&time=19:30:00&showOnly=true&currencyCode=USD'}
					onLoad={() => {
						this.onIframeLoaded(this.seatMapListener);
					}}
					ref={node => (this.seatmapIframe = node)}
				></iframe>
			</div>
		)
	}
}

export default SeatMap;

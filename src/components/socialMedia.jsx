/* Node Dependencies */
import React from 'react';

/* Constants */
import {GITHUB_URL, LINKED_IN_URL, TWITTER_URL, FACEBOOK_URL, WHATSAPP_URL} from 'Constants/index';


const SocialMedia = () => {
	return (
		<header className="header" id="header">
			<ul className="icon-menu header-desktop">
				<li className="icon-box active">
					<i className="fa fa-github-alt"/>
					<a href={GITHUB_URL} target="_blank" rel="noreferrer">
						<h2>Github</h2>
					</a>
				</li>
				<li className="icon-box">
					<i className="fa fa-linkedin"/>
					<a href={LINKED_IN_URL} target="_blank" rel="noreferrer">
						<h2>LinkedIn</h2>
					</a>
				</li>
				<li className="icon-box">
					<i className="fa fa-twitter"/>
					<a href={TWITTER_URL} target="_blank" rel="noreferrer">
						<h2>Twitter</h2>
					</a>
				</li>
				<li className="icon-box">
					<i className="fa fa-facebook-f"/>
					<a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
						<h2>Facebook</h2>
					</a>
				</li>
				<li className="icon-box">
					<i className="fa fa-whatsapp"/>
					<a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
						<h2>WhatsApp</h2>
					</a>
				</li>
			</ul>
		</header>
	)
}

export default SocialMedia;


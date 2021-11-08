/* Node Dependencies */
import React from 'react';

const Conditional = props => (props.if ? props.children : null);

export default Conditional;

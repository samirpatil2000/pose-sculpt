import React, { forwardRef, useImperativeHandle, useState, useEffect } from 'react';

const Toast = forwardRef((props, ref) => {
    const [message, setMessage] = useState('');
    const [isVisible, setIsVisible] = useState(false);

    useImperativeHandle(ref, () => ({
        show: (msg) => {
            setMessage(msg);
            setIsVisible(true);
            setTimeout(() => setIsVisible(false), 2000);
        }
    }));

    return (
        <div className={`toast ${isVisible ? 'show' : ''}`}>
            {message}
        </div>
    );
});

export default Toast;

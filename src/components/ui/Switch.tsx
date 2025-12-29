import React from 'react';
import { logger } from '../../lib/logger';
import { analytics, trackEvent } from '../../services/analytics';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const Switch: React.FC<SwitchProps> = ({
    checked,
    onChange,
    disabled = false,
    label,
    className = '',
    size = 'md'
}) => {
    const sizeClasses = {
        sm: { w: 'w-9', h: 'h-5', thumb: 'h-3.5 w-3.5', translate: 'translate-x-4', rtlTranslate: '-translate-x-4', p: 'p-0.5' },
        md: { w: 'w-11', h: 'h-6', thumb: 'h-5 w-5', translate: 'translate-x-5', rtlTranslate: '-translate-x-5', p: 'p-0.5' },
        lg: { w: 'w-14', h: 'h-7', thumb: 'h-6 w-6', translate: 'translate-x-7', rtlTranslate: '-translate-x-7', p: 'p-0.5' },
    };

    const s = sizeClasses[size];

    return (
        <label className={`group relative inline-flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={(e) => {
                    const nextVal = e.target.checked;
                    if (!disabled) {
                        logger.info('UPDATE', `Toggled ${label || 'Switch'} to ${nextVal}`, {
                            category: 'ui',
                            label,
                            value: nextVal
                        });
                        trackEvent('switch_toggle', 'UI', label || 'switch', nextVal ? 1 : 0);
                        onChange(nextVal);
                    }
                }}
                disabled={disabled}
            />

            {/* Track */}
            <div className={`
                ${s.w} ${s.h} ${s.p}
                bg-slate-200 
                peer-focus:outline-none 
                peer-focus:ring-4 
                peer-focus:ring-blue-100/50
                rounded-full 
                peer 
                transition-colors duration-100 ease-in-out
                peer-checked:bg-green-500
            `}>
                {/* Thumb */}
                <div className={`
                    bg-white 
                    rounded-full 
                    shadow-sm 
                    ${s.thumb}
                    transition-transform duration-100 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]
                    peer-checked:${s.translate}
                    rtl:peer-checked:${s.rtlTranslate}
                `}></div>
            </div>

            {label && (
                <span className="ms-3 text-sm font-medium text-slate-700 select-none group-hover:text-slate-900 transition-colors">
                    {label}
                </span>
            )}
        </label>
    );
};

export const OptimisticSwitch: React.FC<SwitchProps> = (props) => {
    const [localChecked, setLocalChecked] = React.useState(props.checked);

    React.useEffect(() => {
        setLocalChecked(props.checked);
    }, [props.checked]);

    const handleChange = (newVal: boolean) => {
        setLocalChecked(newVal);
        props.onChange(newVal);
    };

    return <Switch {...props} checked={localChecked} onChange={handleChange} />;
};

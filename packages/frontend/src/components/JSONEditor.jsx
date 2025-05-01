import React, { useEffect, useRef, useState } from 'react';
import { Alert } from 'antd';

// This is a simple JSON editor component
const JSONEditor = ({ value, onChange, onValidate, height = '200px' }) => {
    const [error, setError] = useState(null);
    const editorRef = useRef(null);

    // Initialize with formatted JSON
    useEffect(() => {
        if (value) {
            try {
                // Format the JSON if it's valid
                const formattedJson = formatJson(value);

                // Only update if the formatted value is different (prevents cursor jumps)
                if (formattedJson !== value) {
                    onChange(formattedJson);
                }

                setError(null);
                onValidate && onValidate(true);
            } catch (err) {
                // Keep the value as is if it's invalid
                setError(err.message);
                onValidate && onValidate(false);
            }
        }
    }, []);

    // Handle content changes
    const handleChange = (e) => {
        const content = e.target.value;
        onChange(content);

        try {
            // Check if valid JSON
            JSON.parse(content);
            setError(null);
            onValidate && onValidate(true);
        } catch (err) {
            setError(err.message);
            onValidate && onValidate(false);
        }
    };

    // Format JSON with proper indentation
    const formatJson = (jsonString) => {
        const parsed = JSON.parse(jsonString);
        return JSON.stringify(parsed, null, 2);
    };

    // Auto-format JSON on blur
    const handleBlur = () => {
        try {
            const formattedJson = formatJson(value);
            onChange(formattedJson);
            setError(null);
            onValidate && onValidate(true);
        } catch (err) {
            // If can't format, keep as is
            setError(err.message);
            onValidate && onValidate(false);
        }
    };

    return (
        <div>
            <textarea
                ref={editorRef}
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                style={{
                    width: '100%',
                    height: height,
                    fontFamily: 'monospace',
                    padding: '12px',
                    fontSize: '14px',
                    border: `1px solid ${error ? '#ff4d4f' : '#d9d9d9'}`,
                    borderRadius: '4px',
                    backgroundColor: '#f5f5f5',
                    resize: 'vertical',
                }}
                spellCheck="false"
            />

            {error && (
                <Alert
                    message="Invalid JSON"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginTop: 8 }}
                />
            )}
        </div>
    );
};

export default JSONEditor;
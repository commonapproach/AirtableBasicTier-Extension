import React from "react";

export const Button = ({ children, onClick, style = {} }) => {
  const defaultStyle = {
    backgroundColor: "#007BFF", // Primary color
    color: "white",
    padding: "10px 20px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    outline: "none",
    fontSize: "16px",
    transition: "background-color 0.3s",
  };

  const combinedStyles = { ...defaultStyle, ...style };

  return (
    <button onClick={onClick} style={combinedStyles}>
      {children}
    </button>
  );
};

export default Button;

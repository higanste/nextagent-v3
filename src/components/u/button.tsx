"use client";

import { ReactNode, MouseEvent } from "react";

export interface ButtonProps {
  children: ReactNode;
  variant?: "default" | "outline" | "secondary";
  size?: "sm" | "md" | "lg";
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
}

export function Button({ 
  children, 
  variant = "default", 
  size = "md", 
  onClick, 
  disabled = false, 
  className = "",
  ...props 
}: ButtonProps) {
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-primary text-primary hover:bg-primary/10",
    secondary: "bg-gray-200 hover:bg-gray-300",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center rounded-md 
        font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary 
        ${variantClasses[variant] || variantClasses.default}
        ${sizeClasses[size] || sizeClasses.md}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
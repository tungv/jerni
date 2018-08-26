import React from 'react';

const Header = ({ children }) => (
  <header>
    <h1>{children}</h1>
    <style jsx>{`
      header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;

        height: 72px;
        font-family: 'Open Sans';
      }
    `}</style>
  </header>
);

export default Header;

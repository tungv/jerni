import React from "react";
import Head from "next/head";

const MaterialIcon = ({ children }) => (
  <i className="material-icons">
    {children}
    <Head>
      <link
        href="https://fonts.googleapis.com/icon?family=Material+Icons"
        rel="stylesheet"
      />
    </Head>
  </i>
);

export default MaterialIcon;

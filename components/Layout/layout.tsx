import React from "react";
import { Fragment } from "react"
import Header from "./Header";
import Footer from "./Footer";

function Layout(props) {
  return (
    <Fragment>
        <Header />
        <main>{props.children}</main>
        <Footer />
    </Fragment>
  );
}

export default Layout;
<?php
/*
Plugin Name: wp-creative-seo
Plugin URI: https://wp.creative.tv.com
Description: A Creative.Plugin.
Version: 1.0
Author: A-Head Tech
Author URI: https://www.creative.tv.com
License: GPL2
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: wp-creative-seo
Domain Path: /languages 
*/

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}
if ( ! class_exists( 'WP_Creative_SEO' ) ) {
    class WP_Creative_SEO {
        public function __construct() {
            add_action( 'init', array( $this, 'load_textdomain' ) );
            add_action( 'wp_head', array( $this, 'add_meta_tags' ) );
        }

        public function load_textdomain() {
            load_plugin_textdomain( 'wp-creative-seo', false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' );
        }

        public function add_meta_tags() {
            echo '<meta name="description" content="' . esc_attr__( 'A Creative.Plugin.', 'wp-creative-seo' ) . '" />' . "\n";
        }
    }
}       
if ( class_exists( 'WP_Creative_SEO' ) ) {
    $wp_creative_seo = new WP_Creative_SEO();
}
// Add a custom meta box to the post edit screen
function wp_creative_seo_meta_box() {
    add_meta_box(
        'wp_creative_seo_meta',
        __( 'SEO Settings', 'wp-creative-seo' ),
        'wp_creative_seo_meta_box_callback',
        'post'
    );
}
add_action( 'add_meta_boxes', 'wp_creative_seo_meta_box' );
// Callback function to display the meta box






var TeslaClosestLocationImage;
TeslaClosestLocationImage = function () {
    //adding tracking
    var tracker = '?source=footer';
    function LocationValue(location_types){
        this.results_map ={
            8: "store",
            4: "service",
            2: "supercharger",
            1: "standard charger"
        }
        this.location_values = {
            store: 1<<3,
            service: 1<<2,
            supercharger: 1<<1,
            "standard charger": 1<<0
        };
        this.types = location_types;
        var types;
        for (var i=0; i<location_types.length; i++){
            var location_type = location_types[i];
            if( location_type == "destination charger" ) location_type = "standard charger";
            var current_type = this.location_values[location_type];
            types = types | current_type;

        }
        this.type_value = types;

    }
    LocationValue.prototype.getValue = function (){
        var result = this.type_value;
        result |= result >> 8;
        result |= result >> 4;
        result |= result >> 2;
        result |= result >> 1;
        result ^= result >> 1;
        return result;
    }
    LocationValue.prototype.getType = function(filter_types){
        var f_types;
        for (var i=0; i<filter_types.length; i++){
            f_types = f_types | this.location_values[filter_types[i]];
        }
        //console.log("filter values ", filter_types);
        var result = f_types & this.type_value;
        result |= result >> 8;
        result |= result >> 4;
        result |= result >> 2;
        result |= result >> 1;
        result ^= result >> 1;
        return this.results_map[result] || null;
    };


    var image_zoom = 11;
    var image_width = 200;
    var max_width = 640;
    var image_padding = 10;
    var image_height = 125;
    var search_radius = 2000;
    //maximum amount of images we can have
    var max_images = 3;
    var images = [];
    var image_holder = $(".pane-full-footer .locations");
    var search_order = ["store", "service", "supercharger"];
    var locations_service_url = "/all-locations/radius?";
    var strings_translated = {
        store: store_translate,
        service: service_translate,
        supercharger: supercharger_translate,
        gallery: gallery_translate
    }

    this.ipInfoLookup = function(){
        var latLong = readCookie("latLong");
        if ( !latLong ){
            var onSuccess = function onSuccess(context){
                return function onData(data){
                    var location_latlong;
                    try{
                        location_latlong = data.location.latitude + ',' + data.location.longitude;
                    }catch(e){
                        location_latlong = "0,0";
                    }
                    createCookie("latLong", location_latlong, 0.1);
                    context.getLocations(location_latlong);
                }
            }(this);
            var onError = function onError(data){
                if (typeof data !== 'undefined') {
                    console.error(data);
                }
            }
            if (typeof geoip2 !== "undefined") {
                geoip2.city(onSuccess, onError);
            }

        }else{
            this.getLocations(latLong);
        }

    };
    this.getLocations = function(latLong){

        if ( !latLong ){
            latLong = "0,0";
        }
        var latLong = latLong.split(',');
        var lat = latLong[0];
        var lng = latLong[1];
        var url = locations_service_url + 'exclude_open_soon=yes&type=service,store,supercharger' + '&lat='+lat+'&lng='+lng+'&radius=' + search_radius;
        
        $.ajax({
            url: url,
            context: this
        }).done(function(data){
            //get locations that are store, service and/or supercharger. Could be one location
            var closest_locations = this.findClosestLocations(data);
            for (var i=0; i<closest_locations.length; i++){
                var result = [];
                var types = closest_locations[i].location_type_searched;
                _.each(search_order, function (key){
                    var found = false;
                    types = types.filter(function (item){
                        if(!found && item == key){
                            result.push(item);
                            found = true;
                            return false;
                        }else{
                            return true;
                        }
                    })
                });

                closest_locations[i].location_type_searched = result;
            }

            for (var i=0; i<closest_locations.length; i++){
                var location_types_searched =closest_locations[i].location_type_searched;
                var calc_image_width = sizeImage(max_width, location_types_searched.length);//Math.floor( image_width * location_types_searched.length + (image_padding * (location_types_searched.length - 1)) ) ;
                var is_supercharger_name = closest_locations[i].title.toLowerCase().indexOf("supercharger");
                if(is_supercharger_name >= 0){
                    //remove supercharger from the name
                    var location_name = closest_locations[i].title.slice(0, is_supercharger_name);
                }else{
                    var location_name = closest_locations[i].title;
                }
                location_name = location_name.trim();
                var is_multiple = location_types_searched.length > 1;
                var title_part = is_multiple ? your_closest_translate : "";
                for(var j = 0; j < location_types_searched.length; j++){
                    var comma = ( j > 0 && j < location_types_searched.length - 1 )? "," : "";
                    title_part += comma + " " + ((j == location_types_searched.length-1 && location_types_searched.length > 1)? and_translate : "" )+ " " + strings_translated[this.getType( closest_locations[i].is_gallery ,location_types_searched[j])];
                }
                var title_full = is_multiple ? title_part + " " + is_translate + " " + location_name : location_name + title_part;
                var location_value = new LocationValue (location_types_searched);
                var value = location_value.getValue();
                const image_id = location_types_searched + '_' + i;
                var source_url = this.getImageUrl(closest_locations[i], image_zoom, calc_image_width, image_height, image_id);
                var image = {
                    title: title_full,
                    alias: Drupal.settings.tesla.localePrefix + closest_locations[i].path + tracker,
                    width: calc_image_width,
                    height: image_height,
                    weight: value,
                    source: source_url,
                    span: location_types_searched.length,
                    image_el: null,
                    inView: footerInView,
                    render : function(){
                        this.parent = $("#locationTemplate").tmpl(this).appendTo(".locations-map-images");
                        var $image = $(this.parent.find("img"));
                        this.image_el = $image;
                        this.image_el.attr("id", image_id);
                        this.parent.css("width", this.width+ image_padding + "px");
                        if ( typeof is_cn_site === 'undefined') {
                            //console.log('this source', this.source);
                            this.image_el.hide();

                            this.image_el.on('load', function(){
                                $(this).fadeIn();
                            })
                            //check if in view
                            if( this.inView() ){
                                this.image_el.attr("src" , this.source);
                            }else{
                                var handler = function(el){
                                    return function(){
                                        if(el.inView()){
                                            el.image_el.attr("src", el.source);
                                        }
                                    }
                                }
                                $(window).on('DOMContentLoaded load resize scroll', handler(this));
                            }

                        } else {
                            this.image_el.hide();
                            this.image_el.on('load', function(){
                                $(this).fadeIn();
                            })
                            this.image_el.attr("src" , "https://www.tesla.com/static-map?resp=image&options=" + this.source);
                        }
                    }
                }
                images.push(image);

            }

            //if we did not find any close locations or one for the types, display world image;
            if ( closest_locations.length == 0 ){
                images.push( this.getWorldLocation() );
            }
            var len = images.length, max;
            for (var k=0; k<len; k++){
                max = k;
                for (var j=k+1; j < len; j++){
                    if ( images[j].weight > images[max].weight ){
                        max = j;
                    }
                }
                //if the minimum isn't in the position, swap it
                if ( k != max ){
                    swap(images, k, max);
                }
            }

            //attach position class last to the last image
            images[len-1].position = "last";

            for ( var i=0; i < images.length; i++ ){
                images[i].render();
            }
            //resize images
            resizeImages();
            //re-order array in order store, service, supercharger
            function swap(items, firstIndex, secondIndex){
                var temp = items[firstIndex];
                items[firstIndex] = items[secondIndex];
                items[secondIndex] = temp;
            }



        })
    };
    this.getType = function (isGallery, type){

        return isGallery && type == "store" ? "gallery" : type;

    }

    this.getWorldLocation = function(){
        return {
            title: "",
            alias: "#",
            width: sizeImage(max_width, 1),
            height: image_height,
            weight: 8,
            span: 3,
            inView: footerInView,
            source: this.getImageUrl( {location_type_searched:[], latitude:0, longitude:0 }, 1, image_width*3, image_height, "image_world"),
            render : function(){
                this.parent = $("#locationTemplate").tmpl(this).appendTo(".locations-map-images");
                var $image = $(this.parent.find("img"));
                this.image_el = $image;
                this.parent.css("width", this.width+ image_padding + "px");//.css("overflow", "hidden");
                this.image_el.attr("id", "image_world");
                this.image_el.hide();
                this.image_el.on('load', function(){
                    $(this).fadeIn();
                })
                this.image_el.attr("src" , this.source);


            }
        }
    }
    this.findClosestLocations = function(data){
        var i = 0;
        var search_types = ["store", "service", "supercharger"];
        var total_locations = data.length;
        var found_types = search_types.slice();
        var found_locations = [];
        while( found_types.length > 0 && i < total_locations ){
            var current_location = data[i];
            var current_location_types = current_location.location_type;
            for( var j=0; j < current_location_types.length; j++ ){
                var current_type = current_location_types[j];
                for( var k = 0; k < search_types.length; k++ ){
                    if( current_type == search_types[k] ){
                        var index = $.inArray(current_type, found_types);
                        found_types.splice(index, 1);
                        var index_current_found = $.inArray( current_location, found_locations )
                        if ( index_current_found == -1 ){
                            current_location.location_type_searched = [];
                            current_location.location_type_searched.push(search_types[k]);
                            found_locations.push(current_location);
                        } else {
                            found_locations[index_current_found].location_type_searched.push(search_types[k]);
                        }

                    }
                }
                search_types = found_types.slice();
            }
            i++;
        }

        return found_locations;

    }

    this.getImageUrl = function (location, zoom, width, height, image_id){

        const image_url = "/sites/all/modules/custom/tesla_findus_map/assets/";
        let icons = {
            store: image_url + "icon-store@2x.png",
            service: image_url + "icon-service@2x.png",
            supercharger: image_url + "icon-supercharger@2x.png",
            "standard charger": image_url + "icon-charger@2x.png"
        };
        let location_icon = new LocationValue(location.location_type_searched);
        const icon_uri = icons[location_icon.getType(location.location_type_searched)];
        const store_icon_url = "https://www.tesla.com" + icon_uri;

        const latlong = location.latitude + ',' +  location.longitude;

        const map_options =  '%26center='+ latlong + '%26zoom=' + zoom + '%26size=' + 
            width + 'x' + height + '%26markers=scale:2|icon:' + store_icon_url + '|' + 
            latlong + '%26maptype=roadmap%26style=feature:road.highway|element:geometry.fill|saturation:-100|lightness:50%26style=element:geometry.stroke|saturation:-100%26style=feature:road|element:labels.text|saturation:-100%26style=feature:poi|visibility:off';

        const static_map_api_url = '/static-map?options=' + map_options;

        // Make an ajax call to get the static Google map url
        $.ajax({
            url: static_map_api_url,
            context: this
        }).done(function(data){
            // Dynamically add the static google map url returned by an api call
            $('#'+image_id).attr("src", data);
        });
    }
    function sizeImage ( width_available, image_span ){

        return Math.floor( width_available * image_span/max_images - image_padding ) ;

    }
    function resizeImages(){
        var available_width = Math.min(Math.floor(image_holder.innerWidth()-1), max_width);

        for(var i= 0; i<images.length; i++){
            var width = sizeImage(available_width, images[i].span);
            images[i].image_el.attr("width", width);
            images[i].parent.css("width",  width + image_padding + "px");
        }
    }
    $(window).resize (function (){
        resizeImages();
    });
    this.ipInfoLookup();

};

$(document).ready(TeslaClosestLocationImage);

function footerInView(){
    var el = $('.pane-full-footer')[0];
    var rect = el.getBoundingClientRect();
    return (
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) - 150 && rect.left >= 0
    );
};
(function(a){var r=a.fn.domManip,d="_tmplitem",q=/^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,b={},f={},e,p={key:0,data:{}},h=0,c=0,l=[];function g(e,d,g,i){var c={data:i||(d?d.data:{}),_wrap:d?d._wrap:null,tmpl:null,parent:d||null,nodes:[],calls:u,nest:w,wrap:x,html:v,update:t};e&&a.extend(c,e,{nodes:[],parent:d});if(g){c.tmpl=g;c._ctnt=c._ctnt||c.tmpl(a,c);c.key=++h;(l.length?f:b)[h]=c}return c}a.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(f,d){a.fn[f]=function(n){var g=[],i=a(n),k,h,m,l,j=this.length===1&&this[0].parentNode;e=b||{};if(j&&j.nodeType===11&&j.childNodes.length===1&&i.length===1){i[d](this[0]);g=this}else{for(h=0,m=i.length;h<m;h++){c=h;k=(h>0?this.clone(true):this).get();a.fn[d].apply(a(i[h]),k);g=g.concat(k)}c=0;g=this.pushStack(g,f,i.selector)}l=e;e=null;a.tmpl.complete(l);return g}});a.fn.extend({tmpl:function(d,c,b){return a.tmpl(this[0],d,c,b)},tmplItem:function(){return a.tmplItem(this[0])},template:function(b){return a.template(b,this[0])},domManip:function(d,l,j){if(d[0]&&d[0].nodeType){var f=a.makeArray(arguments),g=d.length,i=0,h;while(i<g&&!(h=a.data(d[i++],"tmplItem")));if(g>1)f[0]=[a.makeArray(d)];if(h&&c)f[2]=function(b){a.tmpl.afterManip(this,b,j)};r.apply(this,f)}else r.apply(this,arguments);c=0;!e&&a.tmpl.complete(b);return this}});a.extend({tmpl:function(d,h,e,c){var j,k=!c;if(k){c=p;d=a.template[d]||a.template(null,d);f={}}else if(!d){d=c.tmpl;b[c.key]=c;c.nodes=[];c.wrapped&&n(c,c.wrapped);return a(i(c,null,c.tmpl(a,c)))}if(!d)return[];if(typeof h==="function")h=h.call(c||{});e&&e.wrapped&&n(e,e.wrapped);j=a.isArray(h)?a.map(h,function(a){return a?g(e,c,d,a):null}):[g(e,c,d,h)];return k?a(i(c,null,j)):j},tmplItem:function(b){var c;if(b instanceof a)b=b[0];while(b&&b.nodeType===1&&!(c=a.data(b,"tmplItem"))&&(b=b.parentNode));return c||p},template:function(c,b){if(b){if(typeof b==="string")b=o(b);else if(b instanceof a)b=b[0]||{};if(b.nodeType)b=a.data(b,"tmpl")||a.data(b,"tmpl",o(b.innerHTML));return typeof c==="string"?(a.template[c]=b):b}return c?typeof c!=="string"?a.template(null,c):a.template[c]||a.template(null,q.test(c)?c:a(c)):null},encode:function(a){return(""+a).split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;")}});a.extend(a.tmpl,{tag:{tmpl:{_default:{$2:"null"},open:"if($notnull_1){_=_.concat($item.nest($1,$2));}"},wrap:{_default:{$2:"null"},open:"$item.calls(_,$1,$2);_=[];",close:"call=$item.calls();_=call._.concat($item.wrap(call,_));"},each:{_default:{$2:"$index, $value"},open:"if($notnull_1){$.each($1a,function($2){with(this){",close:"}});}"},"if":{open:"if(($notnull_1) && $1a){",close:"}"},"else":{_default:{$1:"true"},open:"}else if(($notnull_1) && $1a){"},html:{open:"if($notnull_1){_.push($1a);}"},"=":{_default:{$1:"$data"},open:"if($notnull_1){_.push($.encode($1a));}"},"!":{open:""}},complete:function(){b={}},afterManip:function(f,b,d){var e=b.nodeType===11?a.makeArray(b.childNodes):b.nodeType===1?[b]:[];d.call(f,b);m(e);c++}});function i(e,g,f){var b,c=f?a.map(f,function(a){return typeof a==="string"?e.key?a.replace(/(<\w+)(?=[\s>])(?![^>]*_tmplitem)([^>]*)/g,"$1 "+d+'="'+e.key+'" $2'):a:i(a,e,a._ctnt)}):e;if(g)return c;c=c.join("");c.replace(/^\s*([^<\s][^<]*)?(<[\w\W]+>)([^>]*[^>\s])?\s*$/,function(f,c,e,d){b=a(e).get();m(b);if(c)b=j(c).concat(b);if(d)b=b.concat(j(d))});return b?b:j(c)}function j(c){var b=document.createElement("div");b.innerHTML=c;return a.makeArray(b.childNodes)}function o(b){return new Function("jQuery","$item","var $=jQuery,call,_=[],$data=$item.data;with($data){_.push('"+a.trim(b).replace(/([\\'])/g,"\\$1").replace(/[\r\t\n]/g," ").replace(/\$\{([^\}]*)\}/g,"{{= $1}}").replace(/\{\{(\/?)(\w+|.)(?:\(((?:[^\}]|\}(?!\}))*?)?\))?(?:\s+(.*?)?)?(\(((?:[^\}]|\}(?!\}))*?)\))?\s*\}\}/g,function(m,l,j,d,b,c,e){var i=a.tmpl.tag[j],h,f,g;if(!i)throw"Template command not found: "+j;h=i._default||[];if(c&&!/\w$/.test(b)){b+=c;c=""}if(b){b=k(b);e=e?","+k(e)+")":c?")":"";f=c?b.indexOf(".")>-1?b+c:"("+b+").call($item"+e:b;g=c?f:"(typeof("+b+")==='function'?("+b+").call($item):("+b+"))"}else g=f=h.$1||"null";d=k(d);return"');"+i[l?"close":"open"].split("$notnull_1").join(b?"typeof("+b+")!=='undefined' && ("+b+")!=null":"true").split("$1a").join(g).split("$1").join(f).split("$2").join(d?d.replace(/\s*([^\(]+)\s*(\((.*?)\))?/g,function(d,c,b,a){a=a?","+a+")":b?")":"";return a?"("+c+").call($item"+a:d}):h.$2||"")+"_.push('"})+"');}return _;")}function n(c,b){c._wrap=i(c,true,a.isArray(b)?b:[q.test(b)?b:a(b).html()]).join("")}function k(a){return a?a.replace(/\\'/g,"'").replace(/\\\\/g,"\\"):null}function s(b){var a=document.createElement("div");a.appendChild(b.cloneNode(true));return a.innerHTML}function m(o){var n="_"+c,k,j,l={},e,p,i;for(e=0,p=o.length;e<p;e++){if((k=o[e]).nodeType!==1)continue;j=k.getElementsByTagName("*");for(i=j.length-1;i>=0;i--)m(j[i]);m(k)}function m(j){var p,i=j,k,e,m;if(m=j.getAttribute(d)){while(i.parentNode&&(i=i.parentNode).nodeType===1&&!(p=i.getAttribute(d)));if(p!==m){i=i.parentNode?i.nodeType===11?0:i.getAttribute(d)||0:0;if(!(e=b[m])){e=f[m];e=g(e,b[i]||f[i],null,true);e.key=++h;b[h]=e}c&&o(m)}j.removeAttribute(d)}else if(c&&(e=a.data(j,"tmplItem"))){o(e.key);b[e.key]=e;i=a.data(j.parentNode,"tmplItem");i=i?i.key:0}if(e){k=e;while(k&&k.key!=i){k.nodes.push(j);k=k.parent}delete e._ctnt;delete e._wrap;a.data(j,"tmplItem",e)}function o(a){a=a+n;e=l[a]=l[a]||g(e,b[e.parent.key+n]||e.parent,null,true)}}}function u(a,d,c,b){if(!a)return l.pop();l.push({_:a,tmpl:d,item:this,data:c,options:b})}function w(d,c,b){return a.tmpl(a.template(d),c,b,this)}function x(b,d){var c=b.options||{};c.wrapped=d;return a.tmpl(a.template(b.tmpl),b.data,c,b.item)}function v(d,c){var b=this._wrap;return a.map(a(a.isArray(b)?b.join(""):b).filter(d||"*"),function(a){return c?a.innerText||a.textContent:a.outerHTML||s(a)})}function t(){var b=this.nodes;a.tmpl(null,null,null,this).insertBefore(b[0]);a(b).remove()}})(jQuery);
(function () {

window.Parsley.addValidator(
    'notequalto',
    function (value, nbReference) {
        $reference = $('#'+nbReference).val();
        $net = value == $reference;
        return !$net;
    }, 32)
    .addMessage('en', 'notequalto', 'invalid duplicate entry');

})();;
/*global window */
/**
 * Parsley minint validator allows for a field to have a minimum number of
 *   digits in a given string, however is only applicable if the field is
 *   populated. A minint of 3 would accept:
 *   - 123
 *   - A123
 *   - 1A2B3
 *   - (empty)
 */
(function () {
    'use strict';
    window.Parsley.addValidator(
        'minint',
        function (value, minimum) {
            var hasValue,
                intValue,
                hasIntValue,
                hasMinimum;
            // Strip non numeric.
            intValue = value.replace(/\D/g, '');
            minimum = parseInt(minimum);
            // Ensure either is empty, or is not empty and has enough digits.
            hasValue = (value !== undefined && value !== null && value !== '');
            hasIntValue = (intValue !== undefined && intValue !== null && intValue !== '');
            hasMinimum = !hasValue || (hasIntValue && intValue.length >= minimum);
            return hasMinimum;
        },
        32
    ).addMessage('en', 'minint', 'minimum characters not met');
}());
;
// Hack to make localizeDate() work.
if (typeof curCarInfo === 'undefined') {
    curCarInfo = {};
}

(function (window, document, $, Drupal) {
    "use strict";

    $(function() {
        var $form = $('#tesla-insider-form');
        // Initialize BrowserDetect object if it hasn't already been done.
        if (typeof BrowserDetect !== "undefined" && typeof BrowserDetect.summary === "undefined") {
            BrowserDetect.init();

            // WEB-24227:
            if (BrowserDetect.summary.browser == 'Explorer' && BrowserDetect.summary.version == 8) {
                $('input[name="post-submit"]').removeClass('hide-on-desk').addClass('hide-on-mobile');
                $('input[name="ajax-submit"]').removeClass('hide-on-mobile').addClass('hide-on-desk');
            }
        }
    });

    Drupal.behaviors.tesla_insider_form_prepopulate = {
        attach: function() {
            $(document).ready(function() {
                // Check if user is logged in. If so, populate email field.
                if (Drupal.behaviors.common.isLoggedIn()) {
                    Drupal.behaviors.tesla_insider_form_prepopulate.populate();
                }
            });
        },
        populate: function () {
            // Retrieve the email field for the Tesla insider form.
            var $insiderForm = $('#tesla-insider-form');

            // If the email field is on the page, update it with the locally
            //   cached email address.
            var $insiderFormEmailV1      = $insiderForm.find('#edit-usermail');
            var $insiderFormEmailV2      = $insiderForm.find('#edit-usermail--2');

            if ($insiderFormEmailV1.length) {
                $insiderFormEmailV1.val(Drupal.behaviors.common.getEmailAddress());
            }

            if ($insiderFormEmailV2.length) {
                $insiderFormEmailV2.val(Drupal.behaviors.common.getEmailAddress());
            }
        }
    };

    Drupal.behaviors.tesla_insider_form = {
        attach: function () {

            var $form = $('#tesla-insider-form');
            $('#edit-submit-ti-ajax').on('click', function(e) {
                var reg = new RegExp("(^|&)bd=([^&]*)(&|$)", "i");
                var param = window.location.search.substr(1).match(reg);
                var $adword;
                if (param != null) $adword = unescape(param[2]);
                var cookie = $.cookie('bd');

                if ($adword != null) {
                    $.cookie('bd', $adword, {expires : 30});
                    $('input[name=ad_word_ti]').val($adword);
                } else {
                    if (cookie != null && cookie != '') {
                        $('input[name=ad_word_ti]').val(cookie);
                    }
                }
            });

            var $zip_code = $('#edit-zipcode-ti');
            var $ajax_country = true;
            if ($form.length) {
                $form.parsley().destroy();
                $form.parsley();

                // Fire view-open on first input click (for embedded forms).
                $form.find('.form-item input, .form-item textarea').click(function () {
                    TeslaAnalytics.NewsletterSignup.interactionViewOpen();
                });

                $('#tesla-insider-modal').on('show.bs.modal', function (event) {
                    TeslaAnalytics.NewsletterSignup.interactionViewOpen();
                });

                $('#tesla-insider-modal').on('hide.bs.modal', function (event) {

                    // var mymodal = $(this);
                    if ($('#tesla-insider-modal .thanks').length) {

                        // e.preventDefault();
                        var country = (_.indexOf(['en_US', 'zh_CN'], Drupal.settings.tesla.locale) === -1) ? "/" + Drupal.settings.tesla.locale : '';
                        $('.modal-body', '#tesla-insider-modal').load(country + "/drive/ajax", function () {
                            Drupal.attachBehaviors();
                        });
                        $('#tesla-insider-modal .modal-title').html(Drupal.t('Tesla Insider'));

                    }
                });

                $('.btn-ajax', '#tesla-insider-form').click(function (event) {
                    event.preventDefault(); // Prevent default form submit.
                    var valid = $form.parsley().validate();
                    if (valid && $ajax_country) {
                        $('#tesla-insider-modal .modal-throbber').removeClass('hidden');
                        $(this).trigger('submit_form');
                    }
                });

                // Add browser values to form.
                if (typeof(BrowserDetect) !== "undefined" && typeof(BrowserDetect.summary) === "undefined") {
                    BrowserDetect.init();
                }
                $('#tesla-insider-form').append('<input type="hidden" name="browser_type" value="' + BrowserDetect.summary.browser + '">').
                    append('<input type="hidden" name="browser_version" value="' + BrowserDetect.summary.version + '">').
                    append('<input type="hidden" name="browser_os" value="' + BrowserDetect.summary.OS + '">');

                $('#tesla-insider-form input[type="text"]').keypress(function(e) {
                    if (e.keyCode == 13) {
                        e.stopPropagation();
                        var btn1 = $('#edit-submit-ti-ajax');
                        var btn2 = $('#edit-submit-ti-ajax--2');
                        if (btn1) {
                            btn1.click();
                        }
                        else if (btn2) {
                            btn2.click();
                        }
                        return false;
                    }
                });
                $('#edit-location').change();
            }
        }
    };

}(this, this.document, this.jQuery, this.Drupal));
;

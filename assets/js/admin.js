function ajaxUpdateTrafficplan(_id, params){
    $.ajax({
      url: '/admin/product/' + _id,
      dataType: 'JSON',
      data: params,
      method: "POST"
    }).done(function(data){
      if(!data.err){
        toastr.success(data.message)
      }else{
        toastr.error(data.message)
      }
    }).fail(function(err){
      console.log(err)
      toastr.error('服务器错误')
    })
  }

function recharge(){
  var selected = $(".bs-glyphicons-list li.selected"),
      mobile = $("#mobile").val()
  if(!isMobile(mobile)){
    alert("先输入电话")
    return
  }

  if(!selected){
    alert("请选择套餐")
    return
  }

  $.ajax({
    url: '/admin/order',
    method: "POST",
    dataType: 'JSON',
    data: {
      phone: mobile,
      product_id: selected.data("value")
    }
  }).done(function(data){
    if(!data.errcode){
      toastr.success(data.errmsg)
    }else{
      toastr.error(data.msg)
    }
  }).fail(function(err){
    console.log(err)
    toastr.error("服务器出错")
  })
}

function chooseItem(){
  $(document).on("click", ".bs-glyphicons-list li", function(){
    var $this = $(this)
    if(!$this.hasClass("selected")){
      $(".bs-glyphicons-list li").removeClass("selected")
      $this.addClass("selected")
      $("#product-price").html($this.data("price") + "元")
    }
  })
}

function mobileBlur(successCallback){
  //手机号码失去焦点事件
  $("#mobile").bind("change", function () {
      var mobile = $.trim($(this).val());
      if ($.trim(mobile) == "") {
          return;
      }
      if (!isMobile(mobile)) {
          showDialog("请输入正确的手机号码");
          return;
      }
      getCarrier(mobile, successCallback);
  });
}

function getCarrier(phone, successCallback){
  $.ajax({
    url: '/api/v1/phone/data',
    method: 'GET',
    dataType: 'JSON',
    data: {
      phone: phone,
      access_token: window.accessToken
    }
  }).done(function(result){
    if(result.code === 0 && result.data){
      $("#phone-detail").html(result.data.sp + " " + result.data.province + ' ' + result.data.city).data("provider", result.data.sp).show()
      successCallback(result)
    }else{
      showDialog("请输入正确的手机号码");
    }
  }).fail(function(err) {
    showDialog("服务器错误")
  })
}

function getTrafficplan(source, provider, province){
  if(!source) return
  var template = Handlebars.compile(source);
  $.ajax({
    url: '/api/v1/product/lists',
    dataType: 'JSON',
    data: {
      access_token: window.accessToken
    },
    method: "GET"
  }).done(function(data){
    if(data.errcode != 0){  //服务器维护中
      toastr.error(data.errmsg)
    }else{
      console.log(data.products)
      var _products = data.products.filter(function(product){
        return (product.province == province || (product.province == '中国' || product.province == '全国') )&& product.provider_id == provider;
      })
      var html = template({products: _products})
      $("#data").html(html)
    }
  }).fail(function(err){
    console.log(err)
    alert("服务器错误")
  })
}


$(function(){
  $(".select2").each(function(i, e) {
    var $select2 = $(e).select2({ width: 'resolve' });
    if($(e).find("option").is(":selected") && $(e).find("option:selected").val() != '' ){
      $select2.prop("disabled", $(e).hasClass("disabled"));
    }
  })

  $('.remove').each(function(i, e) {
    $(e).click(function() {
      var $this = $(e),
          el = $this.data('el'),
          targer = '#remove'+el,
          $checkBox = $(targer)
      $checkBox.prop('checked', true)
      $this.parents('.help-block').remove()
    })
  })

  $(".editChoose").on("change", function(e){
    var $this = $(this),
        _id = $this.parent().data("id")
        params = {id: _id}

     params[$this.attr("name")] = $this.val()
     ajaxUpdateTrafficplan(_id, params)
  })

  $(".displaySwich").on("change", function(e){
    var $this = $(this),
        _id = $this.data("id"),
        params = {}

    if($this.prop("checked")){
      params[$this.attr("name")] = "on"
    }
    ajaxUpdateTrafficplan(_id, params)
  })


  var source = $("#detail-template").html()
  if(source !== undefined && source !== ''){
    window.template = Handlebars.compile(source);
  }

  $("select[name='trafficPlanId']").on("change", function(e){
    var $this = $(this)
    $.ajax({
      url: '/admin//product/' + $this.val(),
      dataType: 'JSON',
      method: "GET"
    }).done(function(data){
      if(!data.err){
        var html = template(data.data)
        $("#detail").html(html)
      }else{
        toastr.error(data.message)
      }
    }).fail(function(err){
      console.log(err)
      toastr.error('服务器错误')
    })
  })

  $("#editOrNew").click(function(){
    var id = $("#trafficplan-select2 select[name='trafficPlanId']").val()
    if(id !== undefined && id !== ''){
      window.location.href = '/admin/affiliateconfig/trafficplan/'+ id +'/edit'
    }else{
      toastr.warning("choose a traffic plan")
    }
  })

  $(".cry").click(function(e){
    e.preventDefault();
    var r = confirm("Do you want to cry ?");
    if(r == true){
      var $this = $(this),
          _id = $this.data("id")
      $.ajax({
        url: '/admin/extractorder/' + _id + '/refund',
        dataType: 'JSON',
        method: "POST"
      }).done(function(data){
        if(!data.err){
          toastr.success(data.message)
          $this.remove()
        }else{
          toastr.error(data.message)
        }
      }).fail(function(err){
        console.log(err)
        toastr.error('服务器错误')
      })
    }
    e.stopPropagation();
  })


  $("#charge").on("click", recharge)
  chooseItem()
  mobileBlur(function(result) {
    var providers = {
    '移动': 0,
    '联通': 1,
    '电信': 2
    }
    var source   = $("#trafficplans-template").html();
    if(source !== undefined && source !== ''){
      getTrafficplan(source, providers[result.data.sp], result.data.province)
    }
  });

})
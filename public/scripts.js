hljs.initHighlightingOnLoad();

$(document).ready(function() {
  var csrf = $("meta[name=_csrf]").attr("content");
  if (csrf && csrf.length > 0) {
    $.ajaxSetup({
      headers: {
        'x-csrf-token': csrf,
      },
    });
  }

  var $add_installation_form = $("#add_installation");
  if ($add_installation_form && $add_installation_form.length > 0) {
    var xhr;
    var verified = false;
    $add_installation_form.on("submit", function(e) {
      if (verified) {
        return;
      } else {
        e.preventDefault();
      }

      if (xhr && xhr.readyState != 4) {
        xhr.abort();
      }

      $("#verification_status").text("Testing configuration...");
      $add_installation_form.find("button").prop("disabled", true);
      xhr = $.ajax({
        method: "POST",
        url: "/api/installations/test",
        data: $add_installation_form.serializeArray(),
        error: function(jqXHR, textStatus, err) {
          console.error(jqXHR, textStatus, err);
          $("#verification_status").text("Verification failed. Ensure you followed instructions above, the config is correct, and your Talk installation is valid.");
          $add_installation_form.find("button").prop("disabled", false);
        },
        success: function() {
          verified = true;
          $("#verification_status").text("Verification was successful! Click again to create the installation.");
          $add_installation_form.find("button").prop("disabled", false).text("Complete Installation").toggleClass("btn-secondary btn-success");
          $add_installation_form.one("change", function() {
            verified = false;
            $("#verification_status").text("Configuration was changed since the last test. Click again to test the new configuration.");
            $add_installation_form.find("button").text("Test Configuration").toggleClass("btn-secondary btn-success");
          });
        }
      });
    });
  }

  var $edit_installation_buttons = $("#edit_installation_buttons");
  if ($edit_installation_buttons && $edit_installation_buttons.length > 0) {
    var installationID = $edit_installation_buttons.data("id");
    $edit_installation_buttons.find("button").click(function() {
      var action = $(this).data("action");

      switch (action) {
        case "delete": {
          if (confirm("Are you sure you want to delete this installation? This will prevent comments from going to this channel.")) {
            $.ajax({
              method: "DELETE",
              url: "/api/installation/" + installationID,
              dataType: "json",
              error: function(jqXHR, textStatus, err) {
                if (jqXHR.status === 409) {
                  alert("This installation has linked configurations and cannot be deleted. Delete the linked configurations first.");
                  return;
                }

                alert("Could not delete the installation, check the console for details.");
                console.error(jqXHR, textStatus, err);
              },
              success: function() {
                location.href = "/installations";
              }
            });
          }
          break;
        }
        case "delete-disabled": {
          alert("This installation has linked configurations and cannot be deleted. Delete the linked configurations first.");
          break;
        }
        case "disable": {
          if (confirm("Are you sure you want to disable this installation? This will prevent comments from being injested.")) {
            $.ajax({
              method: "PUT",
              url: "/api/installation/" + installationID,
              data: JSON.stringify({disabled: true}),
              headers: {
                'Content-Type': 'application/json',
              },
              error: function(jqXHR, textStatus, err) {
                alert("Could not update the installation, check the console for details.");
                console.error(textStatus, err);
              },
              success: function() {
                location.reload();
              }
            });
          }
          break;
        }
        case "enable": {
          $.ajax({
            method: "PUT",
            url: "/api/installation/" + installationID,
            data: JSON.stringify({disabled: false}),
            headers: {
              'Content-Type': 'application/json',
            },
            error: function(jqXHR, textStatus, err) {
              alert("Could not update the installation, check the console for details.");
              console.error(textStatus, err);
            },
            success: function() {
              location.reload();
            }
          });
          break;
        }
      }
    });
  }

  var $edit_configuration_buttons = $("#edit_configuration_buttons");
  if ($edit_configuration_buttons && $edit_configuration_buttons.length > 0) {
    var configurationID = $edit_configuration_buttons.data("id");
    $edit_configuration_buttons.find("button").click(function() {
      var action = $(this).data("action");

      switch (action) {
        case "delete": {
          if (confirm("Are you sure you want to delete this configuration? This will prevent comments from going to this channel.")) {
            $.ajax({
              method: "DELETE",
              url: "/api/configuration/" + configurationID,
              error: function(jqXHR, textStatus, err) {
                alert("Could not delete the configuration, check the console for details.");
                console.error(textStatus, err);
              },
              success: function() {
                location.href = "/configurations";
              }
            });
          }
          break;
        }
        case "disable": {
          if (confirm("Are you sure you want to disable this configuration? This will prevent comments from going to this channel.")) {
            $.ajax({
              method: "PUT",
              url: "/api/configuration/" + configurationID,
              data: JSON.stringify({disabled: true}),
              headers: {
                'Content-Type': 'application/json',
              },
              error: function(jqXHR, textStatus, err) {
                alert("Could not update the configuration, check the console for details.");
                console.error(textStatus, err);
              },
              success: function() {
                location.reload();
              }
            });
          }
          break;
        }
        case "enable": {
          $.ajax({
            method: "PUT",
            url: "/api/configuration/" + configurationID,
            data: JSON.stringify({disabled: false}),
            headers: {
              'Content-Type': 'application/json',
            },
            error: function(jqXHR, textStatus, err) {
              alert("Could not update the configuration, check the console for details.");
              console.error(textStatus, err);
            },
            success: function() {
              location.reload();
            }
          });
          break;
        }
      }
    });
  }
});
